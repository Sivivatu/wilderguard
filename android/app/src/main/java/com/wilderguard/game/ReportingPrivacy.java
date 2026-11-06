package com.wilderguard.game;

import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.protocol.Mechanism;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;
import io.sentry.protocol.SentryThread;
import java.util.ArrayList;
import java.util.List;

/** A fresh allowlisted event also covers native and retried cached envelopes. */
final class ReportingPrivacy {
    private static final int MAX_EXCEPTIONS = 3;
    private static final int MAX_FRAMES = 50;

    static SentryEvent sanitize(SentryEvent input) {
        List<SentryException> exceptions = input.getExceptions();
        List<SentryException> unhandled = new ArrayList<>();
        if (exceptions != null) for (SentryException value : exceptions) {
            if (value.getMechanism() != null && Boolean.FALSE.equals(value.getMechanism().isHandled())) unhandled.add(value);
        }
        if (unhandled.isEmpty()) return null;
        SentryEvent clean = new SentryEvent();
        clean.setEventId(input.getEventId());
        clean.setTimestamp(input.getTimestamp());
        clean.setLevel(SentryLevel.ERROR);
        clean.setPlatform(safe(input.getPlatform()));
        clean.setRelease(safeRelease(input.getRelease()));
        clean.setDist(safe(input.getDist()));
        clean.setEnvironment("beta".equals(input.getEnvironment()) ? "beta" : "public");
        List<SentryException> values = new ArrayList<>();
        for (SentryException value : unhandled.subList(Math.max(0, unhandled.size() - MAX_EXCEPTIONS), unhandled.size())) {
            values.add(exception(value, crashedFrames(input)));
        }
        clean.setExceptions(values);
        return clean;
    }

    private static SentryException exception(SentryException input, List<SentryStackFrame> fallback) {
        SentryException clean = new SentryException();
        clean.setType(safe(input.getType()));
        clean.setValue("[redacted]");
        Mechanism mechanism = new Mechanism();
        mechanism.setType("unhandled");
        mechanism.setHandled(false);
        clean.setMechanism(mechanism);
        List<SentryStackFrame> frames = input.getStacktrace() == null ? null : input.getStacktrace().getFrames();
        if (frames == null || frames.isEmpty()) frames = fallback;
        List<SentryStackFrame> cleanFrames = new ArrayList<>();
        if (frames != null) {
            for (SentryStackFrame frame : frames.subList(Math.max(0, frames.size() - MAX_FRAMES), frames.size())) {
                cleanFrames.add(frame(frame));
            }
        }
        clean.setStacktrace(new SentryStackTrace(cleanFrames));
        return clean;
    }

    private static List<SentryStackFrame> crashedFrames(SentryEvent input) {
        List<SentryThread> threads = input.getThreads();
        if (threads != null) for (SentryThread thread : threads) {
            if (Boolean.TRUE.equals(thread.isCrashed()) && thread.getStacktrace() != null) return thread.getStacktrace().getFrames();
        }
        return null;
    }

    private static SentryStackFrame frame(SentryStackFrame input) {
        SentryStackFrame clean = new SentryStackFrame();
        String filename = input.getFilename();
        if (filename != null) {
            String path = filename.split("[?#]", 2)[0];
            String base = path.substring(path.lastIndexOf('/') + 1);
            if (base.matches("[A-Za-z0-9_.-]{1,150}\\.(?:java|kt|so)")) clean.setFilename(base);
            if (path.matches("(?:.*)?/assets/[A-Za-z0-9_-]+\\.js")) clean.setFilename("app:///assets/" + base);
        }
        clean.setFunction(safe(input.getFunction()));
        clean.setModule(safe(input.getModule()));
        if (input.getLineno() != null && input.getLineno() > 0) clean.setLineno(input.getLineno());
        if (input.getColno() != null && input.getColno() > 0) clean.setColno(input.getColno());
        clean.setInstructionAddr(address(input.getInstructionAddr()));
        clean.setImageAddr(address(input.getImageAddr()));
        return clean;
    }

    private static String address(String value) {
        return value != null && value.matches("0x[0-9a-fA-F]{1,16}") ? value : null;
    }

    private static String safeRelease(String value) {
        return value != null && value.matches("com\\.wilderguard\\.game(?:\\.beta)?@[A-Za-z0-9.+-]{1,80}") ? value : null;
    }

    private static String safe(String value) {
        return value != null && value.matches("[A-Za-z0-9_.$<> \\[\\]-]{1,150}") ? value : null;
    }
}
