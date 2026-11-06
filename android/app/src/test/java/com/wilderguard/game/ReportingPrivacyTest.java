package com.wilderguard.game;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import java.util.Collections;
import io.sentry.*;
import io.sentry.protocol.*;

public class ReportingPrivacyTest {
    private SentryEvent crash() {
        SentryEvent event = new SentryEvent();
        event.setRelease("com.wilderguard.game.beta@0.1.0-beta.8+8");
        event.setDist("8");
        event.setEnvironment("beta");
        SentryException exception = new SentryException();
        exception.setType("java.lang.RuntimeException");
        exception.setValue("private@example.com save contents");
        Mechanism mechanism = new Mechanism();
        mechanism.setHandled(false);
        exception.setMechanism(mechanism);
        SentryStackFrame frame = new SentryStackFrame();
        frame.setFilename("/private/path/MainActivity.java");
        frame.setFunction("onCreate");
        frame.setLineno(42);
        frame.setVars(Collections.singletonMap("save", "private"));
        exception.setStacktrace(new SentryStackTrace(Collections.singletonList(frame)));
        event.setExceptions(Collections.singletonList(exception));
        return event;
    }

    @Test public void reconstructsCrashWithoutPrivateFields() {
        SentryEvent original = crash();
        User user = new User(); user.setEmail("private@example.com"); original.setUser(user);
        original.setExtra("save", "private");
        original.addBreadcrumb(new Breadcrumb("private"));
        original.setServerName("private-device");
        SentryEvent clean = ReportingPrivacy.sanitize(original);
        assertNotNull(clean);
        assertNull(clean.getUser()); assertNull(clean.getExtras()); assertNull(clean.getBreadcrumbs());
        assertNull(clean.getServerName()); assertTrue(clean.getContexts().isEmpty());
        assertEquals("[redacted]", clean.getExceptions().get(0).getValue());
        assertEquals("MainActivity.java", clean.getExceptions().get(0).getStacktrace().getFrames().get(0).getFilename());
        assertNull(clean.getExceptions().get(0).getStacktrace().getFrames().get(0).getVars());
        assertEquals("private@example.com save contents", original.getExceptions().get(0).getValue());
    }

    @Test public void dropsHandledAndNonCrashEvents() {
        assertNull(ReportingPrivacy.sanitize(new SentryEvent()));
        SentryEvent event = crash();
        event.getExceptions().get(0).getMechanism().setHandled(true);
        assertNull(ReportingPrivacy.sanitize(event));
    }

    @Test public void removesAllNonEventEnvelopeItems() throws Exception {
        SentryOptions options = new SentryOptions();
        SentryEnvelope envelope = new SentryEnvelope(new SentryEnvelopeHeader(), Arrays.asList(
            SentryEnvelopeItem.fromEvent(options.getSerializer(), crash()),
            SentryEnvelopeItem.fromAttachment(options.getSerializer(), options.getLogger(), new Attachment("private".getBytes(), "save.txt"), 100)
        ));
        SentryEnvelope clean = ReportingTransport.filter(envelope, options.getSerializer());
        int count = 0;
        for (SentryEnvelopeItem item : clean.getItems()) { assertEquals(SentryItemType.Event, item.getHeader().getType()); count++; }
        assertEquals(1, count);
    }
    @Test public void keepsOnlyUnhandledExceptionsAndCrashedThreadFrames() {
        SentryEvent event = crash();
        SentryException unhandled = event.getExceptions().get(0);
        SentryStackTrace stack = unhandled.getStacktrace();
        unhandled.setStacktrace(null);
        SentryThread crashed = new SentryThread(); crashed.setCrashed(true); crashed.setStacktrace(stack);
        event.setThreads(Collections.singletonList(crashed));
        SentryException handled = new SentryException();
        Mechanism mechanism = new Mechanism(); mechanism.setHandled(true); handled.setMechanism(mechanism);
        event.setExceptions(Arrays.asList(unhandled, handled));
        SentryEvent clean = ReportingPrivacy.sanitize(event);
        assertEquals(1, clean.getExceptions().size());
        assertEquals(1, clean.getExceptions().get(0).getStacktrace().getFrames().size());
        assertNull(clean.getThreads());
    }
}
