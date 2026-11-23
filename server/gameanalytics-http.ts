import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import { STABLE_NODE_ID } from './tailscale-node-lookup.ts';
const MAX_BODY_BYTES = 8192;
type Handler = (request: Request) => Promise<Response>;
type AccessOptions = { allowedNodeIds?: string[]; lookupNode?: (ip: string) => Promise<string | null> };

/** Serve headers are trusted only on the loopback listener behind private Serve. */
export async function approvedRelayCaller(headers: IncomingHttpHeaders, peerAddress: string | undefined, allowedUsers: string[], access: AccessOptions): Promise<boolean> {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peerAddress ?? '')) return false;
  const login = headers['tailscale-user-login'];
  if (login !== undefined) return typeof login === 'string' && allowedUsers.includes(login);
  const ip = headers['x-forwarded-for'];
  if (!access.allowedNodeIds?.length || !access.lookupNode || headers['x-forwarded-proto'] !== 'https') return false;
  if (typeof ip !== 'string' || !isIP(ip) || ip.includes('%')) return false;
  try {
    const node = await access.lookupNode(ip);
    return node !== null && access.allowedNodeIds.includes(node);
  } catch { return false; }
}

/** Trust identity headers ONLY from Tailscale Serve through this loopback listener. */
export function createPrivateRelayServer(handler: Handler, allowedUsers: string[], access: AccessOptions = {}) {
  if (!allowedUsers.length || allowedUsers.length > 16 || allowedUsers.some(user => !/^[A-Za-z0-9@._+-]{3,200}$/.test(user))) throw new Error('Invalid private tester allowlist');
  if (access.allowedNodeIds && (access.allowedNodeIds.length > 16 || access.allowedNodeIds.some(id => !STABLE_NODE_ID.test(id)))) throw new Error('Invalid private node allowlist');
  async function handleRequest(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    if (!await approvedRelayCaller(incoming.headers, incoming.socket.remoteAddress, allowedUsers, access)) { outgoing.writeHead(403); outgoing.end(); return; }
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
