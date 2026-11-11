package com.wilderguard.game;

import android.content.pm.PackageInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.sentry.AsyncHttpTransportFactory;
import io.sentry.Sentry;
import io.sentry.android.core.SentryAndroid;
import io.sentry.android.core.SentryAndroidOptions;
import io.sentry.capacitor.SentryCapacitor;
import java.io.File;
import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;

/** Retain the official Capacitor bridge; constrain its Android SDK initialization. */
@CapacitorPlugin(name = "SentryCapacitor")
public class WilderguardSentry extends SentryCapacitor {
    private static final int MAX_REPORTS = 10;
    private AtomicBoolean allowed = new AtomicBoolean(false);

    @Override @PluginMethod
    public void initNativeSdk(PluginCall call) {
        try {
            JSObject config = call.getObject("options");
            if (!valid(config)) { call.reject("Invalid error reporting configuration"); return; }
            allowed.set(false);
            AtomicBoolean gate = new AtomicBoolean(true);
            allowed = gate;
            SentryAndroid.init(getContext(), options -> configure(options, config, gate));
            JSObject response = new JSObject(); response.put("value", true); call.resolve(response);
        } catch (Exception error) {
            allowed.set(false);
            call.reject("Error reporting unavailable");
        }
    }

    private boolean valid(JSObject config) throws Exception {
        if (config == null || config.getString("dsn") == null) return false;
        URI dsn = new URI(config.getString("dsn"));
        if (!"https".equals(dsn.getScheme()) || dsn.getHost() == null ||
            !dsn.getHost().matches("o[0-9]+\\.ingest\\.de\\.sentry\\.io") ||
            dsn.getRawUserInfo() == null || !dsn.getRawUserInfo().matches("[a-f0-9]+") ||
            dsn.getPort() != -1 || dsn.getQuery() != null || dsn.getFragment() != null ||
            !dsn.getPath().matches("/[0-9]+")) return false;
        PackageInfo build = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        String expectedRelease = build.packageName + "@" + build.versionName + "+" + build.versionCode;
        String environment = build.packageName.endsWith(".beta") ? "beta" : "public";
        return expectedRelease.equals(config.getString("release")) &&
            Integer.toString(build.versionCode).equals(config.getString("dist")) &&
            environment.equals(config.getString("environment"));
    }

    private void configure(SentryAndroidOptions options, JSObject config, AtomicBoolean gate) {
        options.setDsn(config.getString("dsn"));
        options.setRelease(config.getString("release"));
        options.setDist(config.getString("dist"));
        options.setEnvironment(config.getString("environment"));
        options.setDebug(false);
        options.setSendDefaultPii(false);
        options.setAttachServerName(false);
        options.setAttachThreads(false);
        options.setAttachStacktrace(false);
        options.setMaxBreadcrumbs(0);
        options.setBeforeBreadcrumb((breadcrumb, hint) -> null);
        options.setEnableAutoSessionTracking(false);
        options.setSendClientReports(false);
        options.getLogs().setEnabled(false);
        options.getMetrics().setEnabled(false);
        options.setTracesSampleRate(0.0);
        options.setProfilesSampleRate(0.0);
        options.setEnableAppStartProfiling(false);
        options.setEnableAutoActivityLifecycleTracing(false);
        options.setEnableUserInteractionTracing(false);
        options.setEnableFramesTracking(false);
        options.setEnableScreenTracking(false);
        options.setEnableAutoTraceIdGeneration(false);
        options.setEnableStandaloneAppStartTracing(false);
        options.setEnablePerformanceV2(false);
        options.setEnableScopePersistence(false);
        options.setEnableSystemEventBreadcrumbs(false);
        options.setEnableAppComponentBreadcrumbs(false);
        options.setEnableNetworkEventBreadcrumbs(false);
        options.setEnableActivityLifecycleBreadcrumbs(false);
        options.setEnableAppLifecycleBreadcrumbs(false);
        options.setEnableUserInteractionBreadcrumbs(false);
        options.setAnrEnabled(false);
        options.setEnableNdkAppHangTracking(false);
        options.setEnableNdk(true);
        options.setEnableScopeSync(false);
        options.setAttachScreenshot(false);
        options.setAttachViewHierarchy(false);
        options.setAttachAnrThreadDump(false);
        options.setAttachRawTombstone(false);
        options.setMaxAttachmentSize(0);
        options.getSessionReplay().setSessionSampleRate(0.0);
        options.getSessionReplay().setOnErrorSampleRate(0.0);
        options.setCacheDirPath(cacheDirectory().getAbsolutePath());
        options.setMaxCacheItems(MAX_REPORTS);
        options.setMaxQueueSize(MAX_REPORTS);
        options.setShutdownTimeoutMillis(0);
        options.setConnectionTimeoutMillis(3000);
        options.setReadTimeoutMillis(3000);
        options.setBeforeSend((event, hint) -> gate.get() ? ReportingPrivacy.sanitize(event) : null);
        options.setBeforeSendTransaction((transaction, hint) -> null);
        options.setTransportFactory((settings, request) -> new ReportingTransport(
            new AsyncHttpTransportFactory().create(settings, request), settings.getSerializer(), gate));
    }

    @PluginMethod public void disableReporting(PluginCall call) {
        allowed.set(false);
        Sentry.close();
        if (!remove(cacheDirectory())) { call.reject("Could not clear error report cache"); return; }
        call.resolve();
    }

    private File cacheDirectory() { return new File(getContext().getCacheDir(), "wilderguard-errors"); }

    private boolean remove(File path) {
        File[] children = path.listFiles();
        if (children != null) for (File child : children) if (!remove(child)) return false;
        return !path.exists() || path.delete();
    }
}
