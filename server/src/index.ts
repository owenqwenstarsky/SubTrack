import { createApp } from './app.js';
import { prisma } from './prisma.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Subtrack API listening on http://0.0.0.0:${port}`);
});

async function shutdown(signal: NodeJS.Signals) {
  console.log(`\nReceived ${signal}, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
