import type express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AppPrisma } from '../app.js';
import { hasValidPasswordCredential } from '../auth.js';
import { createSubtrackMcpServer } from './server.js';

export function mountMcpRoutes(app: express.Express, options: { prisma: AppPrisma; maxGeneratedPayments: number }) {
  app.use('/api/mcp', (req, res, next) => {
    if (!isAllowedHost(req)) {
      res.status(403).json({ error: 'Forbidden host' });
      return;
    }

    if (!hasValidPasswordCredential(req)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="SubTrack MCP"');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  });

  const handler = async (req: express.Request, res: express.Response) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createSubtrackMcpServer(options);
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    } finally {
      await server.close().catch(() => undefined);
    }
  };

  app.post('/api/mcp', handler);
  app.get('/api/mcp', handler);
  app.delete('/api/mcp', handler);
}

function isAllowedHost(req: express.Request): boolean {
  const host = req.hostname;
  if (!host) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [];
  return configuredOrigins.some((origin) => {
    try {
      return new URL(origin).hostname === host;
    } catch {
      return false;
    }
  });
}
