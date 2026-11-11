package com.wilderguard.game;

import io.sentry.Hint;
import io.sentry.ISerializer;
import io.sentry.SentryEnvelope;
import io.sentry.SentryEnvelopeHeader;
import io.sentry.SentryEnvelopeItem;
import io.sentry.SentryEvent;
import io.sentry.SentryItemType;
import io.sentry.transport.ITransport;
import io.sentry.transport.RateLimiter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/** No attachments, sessions, logs, replay, transactions or trace headers reach the HTTP transport. */
final class ReportingTransport implements ITransport {
    private final ITransport delegate;
    private final ISerializer serializer;
    private final AtomicBoolean allowed;

    ReportingTransport(ITransport delegate, ISerializer serializer, AtomicBoolean allowed) {
        this.delegate = delegate;
        this.serializer = serializer;
        this.allowed = allowed;
    }

    static SentryEnvelope filter(SentryEnvelope input, ISerializer serializer) throws Exception {
        List<SentryEnvelopeItem> items = new ArrayList<>();
        for (SentryEnvelopeItem item : input.getItems()) {
            if (item.getHeader().getType() != SentryItemType.Event) continue;
            SentryEvent event = item.getEvent(serializer);
            SentryEvent clean = event == null ? null : ReportingPrivacy.sanitize(event);
            if (clean != null) items.add(SentryEnvelopeItem.fromEvent(serializer, clean));
        }
        if (items.isEmpty()) return null;
        return new SentryEnvelope(new SentryEnvelopeHeader(input.getHeader().getEventId(), null), items);
    }

    @Override public void send(SentryEnvelope envelope, Hint hint) throws IOException {
        if (!allowed.get()) return;
        try {
            SentryEnvelope clean = filter(envelope, serializer);
            if (clean != null && allowed.get()) delegate.send(clean, hint);
        } catch (Exception ignored) {
            // Fail closed for reporting; malformed diagnostics must never interrupt gameplay.
        }
    }

    @Override public void flush(long timeoutMillis) { delegate.flush(timeoutMillis); }
    @Override public RateLimiter getRateLimiter() { return delegate.getRateLimiter(); }
    @Override public boolean isHealthy() { return delegate.isHealthy(); }
    @Override public void close(boolean restarting) throws IOException { delegate.close(restarting); }
    @Override public void close() throws IOException { delegate.close(); }
}
