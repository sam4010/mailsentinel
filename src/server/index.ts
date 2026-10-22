import { createApp } from './app.js';
import { config } from './config.js';
import { SyncWorker } from './sync/worker.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🛡️  MailSentinel Server running on http://localhost:${config.port}`);
  console.log(`⚙️  Environment: ${config.nodeEnv}`);
  console.log(`🔑 Google OAuth: ${config.google.isConfigured ? 'Configured' : 'Needs Setup'}`);
  console.log(`🔔 Web Push (VAPID): ${config.vapid.isConfigured ? 'Configured' : 'Needs Setup'}`);
  console.log(`=======================================================`);

  // Start background email polling worker
  SyncWorker.start();
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Server] Shutting down gracefully...');
  SyncWorker.stop();
  server.close(() => {
    console.log('[Server] Closed remaining connections.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
