import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
const MAX_BODY_BYTES = 8192;
type Handler = (request: Request) => Promise<Response>;
/** Trust identity headers ONLY from Tailscale Serve through this loopback listener. */
export function createPrivateRelayServer(handler: Handler, allowedUsers: string[]) {
  if (!allowedUsers.length || allowedUsers.length > 16 || allowedUsers.some(user => !/^[A-Za-z0-9@._+-]{3,200}$/.test(user))) throw new Error('Invalid private tester allowlist');
  async function handleRequest(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    if (!allowedUsers.includes(String(incoming.headers['tailscale-user-login'] ?? ''))) { outgoing.writeHead(403); outgoing.end(); return; }
    let body = Buffer.alloc(0);
    for await (const chunk of incoming) {
      const next = Buffer.from(chunk);
      if (body.length + next.length > MAX_BODY_BYTES) { outgoing.writeHead(413); outgoing.end(); return; }
      body = Buffer.concat([body, next]);
    }
    const method = incoming.method ?? 'GET';
    const request = new Request(`http://127.0.0.1${incoming.url ?? '/'}`, { method,
      headers: { Origin: incoming.headers.origin ?? '', 'Content-Type': String(incoming.headers['content-type'] ?? ''), 'X-Telemetry-Epoch': String(incoming.headers['x-telemetry-epoch'] ?? '') },
      ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body } : {}),
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries())); outgoing.end(await response.text());
  }
  const server = createServer((incoming, outgoing) => { void handleRequest(incoming, outgoing).catch(() => {
    if (!outgoing.headersSent) outgoing.writeHead(503);
    outgoing.end();
  }); });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxConnections = 8;
  return server;
}
