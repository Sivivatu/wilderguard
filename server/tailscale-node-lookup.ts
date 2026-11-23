import { request } from 'node:http';
import { isIP } from 'node:net';

const MAX_RESPONSE_BYTES = 65_536;
export const STABLE_NODE_ID = /^n[A-Za-z0-9]{1,127}$/;

/** Query only the local daemon; caller IPs never become arbitrary URLs. */
export function createTailscaleNodeLookup(options: { socketPath?: string; timeoutMs?: number } = {}) {
  const socketPath = options.socketPath ?? '/var/run/tailscale/tailscaled.sock';
  const timeoutMs = options.timeoutMs ?? 1000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw new Error('Invalid identity timeout');
  return async (ip: string): Promise<string | null> => {
    if (!isIP(ip) || ip.includes('%')) return null;
    return new Promise(resolve => {
      let settled = false;
      const finish = (node: string | null) => {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(node);
      };
      const pending = request({ socketPath, method: 'GET', headers: { Host: 'local-tailscaled.sock' }, path: `/localapi/v0/whois?addr=${encodeURIComponent(ip)}` }, response => {
        if (response.statusCode !== 200) { finish(null); response.destroy(); return; }
        let body = Buffer.alloc(0);
        response.on('data', (chunk: Buffer) => {
          if (body.length + chunk.length > MAX_RESPONSE_BYTES) { finish(null); response.destroy(); return; }
          body = Buffer.concat([body, chunk]);
        });
        response.on('error', () => finish(null));
        response.on('end', () => {
          try {
            const value = JSON.parse(body.toString('utf8')) as { Node?: { StableID?: unknown } } | null;
            const id = value?.Node?.StableID;
            finish(typeof id === 'string' && STABLE_NODE_ID.test(id) ? id : null);
          } catch { finish(null); }
        });
      });
      const timer = setTimeout(() => { finish(null); pending.destroy(); }, timeoutMs);
      pending.on('error', () => finish(null));
      pending.end();
    });
  };
}
