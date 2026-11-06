import { finishStartupCapture, discardStartupCapture } from './startup-errors';
import * as Sentry from '@sentry/capacitor';
import { Capacitor } from '@capacitor/core';
import { globalHandlersIntegration, dedupeIntegration, init as browserInit, makeBrowserOfflineTransport } from '@sentry/browser';
import { REPORT_QUEUE_LIMIT, sanitizeErrorEvent, type ReportingConfig } from './error-policy';
import { clearReportingCaches, clearBrowserReports, nativeReporting, REPORTING_DATABASE } from './reporting-storage';

let isAllowed = () => false;
let browserTransport: ReturnType<NonNullable<Sentry.CapacitorOptions['transport']>> | undefined;
const QUEUE_PROJECT_KEY = 'wilderguard-errors-project-v1';
export async function start(config: ReportingConfig, allowed: () => boolean): Promise<void> {
  isAllowed = allowed;
  const isNative = Capacitor.getPlatform() === 'android';
  if (isNative) {
    const build = await nativeReporting.fetchNativeRelease();
    const expectedEnvironment = build.id.endsWith('.beta') ? 'beta' : 'public';
    if (config.environment !== expectedEnvironment || config.release !== `${build.id}@${build.version}+${build.build}` || config.dist !== build.build) {
      throw new Error('Reporting release does not match this Android build');
    }
  }
  // Never deliver queued reports from one project into a different project.
  if (localStorage.getItem(QUEUE_PROJECT_KEY) !== config.dsn) {
    await clearReportingCaches();
    localStorage.setItem(QUEUE_PROJECT_KEY, config.dsn);
  }
  if (!isAllowed()) return;
  const options: Sentry.CapacitorOptions = {
    dsn: config.dsn, environment: config.environment, release: config.release, dist: config.dist,
    enableNative: isNative, enableNativeCrashHandling: isNative, enableNativeNagger: false,
    enableAutoSessionTracking: false, enableWatchdogTerminationTracking: false,
    enableAppHangTracking: false, enableCaptureFailedRequests: false,
    enableNdkScopeSync: false, attachThreads: false, attachStacktrace: false,
    sendDefaultPii: false, sendClientReports: false, maxBreadcrumbs: 0,
    enableLogs: false, tracesSampleRate: 0, tracePropagationTargets: [],
    _experiments: { enableMetrics: false },
    defaultIntegrations: false,
    integrations: [globalHandlersIntegration(), dedupeIntegration()],
    beforeBreadcrumb: () => null,
    beforeSend: (event, hint) => {
      if (!allowed()) return null;
      // Browser eventFromException marks manual captures handled, even with a mechanism hint.
      // This private startup path represents errors observed by our temporary global handlers.
      const startup = hint.mechanism?.type === 'wilderguard.startup' && hint.mechanism.handled === false;
      const candidate = startup ? { ...event, exception: { values: event.exception?.values?.slice(0, 1).map(value => ({ ...value, mechanism: { type: 'startup', handled: false } })) } } : event;
      const clean = sanitizeErrorEvent(candidate);
      return clean ? { ...clean, release: config.release, dist: config.dist, environment: config.environment } : null;
    },
    beforeSendTransaction: () => null,
  };
  if (!isNative) {
    // Reuse the transport: the official offline wrapper installs one online listener per instance.
    options.transport = transportOptions => {
      if (!browserTransport) browserTransport = makeBrowserOfflineTransport()(transportOptions);
      return browserTransport;
    };
    options.transportOptions = {
      dbName: REPORTING_DATABASE, maxQueueSize: REPORT_QUEUE_LIMIT, flushAtStartup: true,
      shouldSend: () => isAllowed(), shouldStore: () => isAllowed(),
    } as NonNullable<Sentry.CapacitorOptions['transportOptions']>;
  }
  await new Promise<void>((resolve, reject) => {
    try {
      Sentry.init(options, browserOptions => {
        // Native init is asynchronous. Reject its browser-only fallback rather than losing native privacy/cache guarantees.
        try {
          if (isNative && !browserOptions.transport) throw new Error('Native error reporting unavailable');
          if (allowed()) {
            browserInit(browserOptions);
            finishStartupCapture(error => Sentry.captureException(error, { mechanism: { handled: false, type: 'wilderguard.startup' } }));
          } else if (isAllowed === allowed) void stop().catch(() => {});
          resolve();
        } catch (error) {
          void stop().catch(() => {});
          reject(error);
        }
      });
    } catch (error) { reject(error); }
  });
}

export async function stop(): Promise<void> {
  isAllowed = () => false;
  discardStartupCapture();
  // Native gate closes before SDK shutdown can flush; all caches are then removed.
  try { await clearReportingCaches(); }
  finally {
    await Sentry.close();
    await clearBrowserReports();
  }
}
