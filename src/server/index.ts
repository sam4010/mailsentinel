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

  // 24/7 Keep-alive monitor on cloud platforms (prevents Render free tier spin-down)
  const pingUrl = process.env.RENDER_EXTERNAL_URL || (config.nodeEnv === 'production' ? 'https://mailsentinel-0azx.onrender.com' : null);
  if (pingUrl) {
    const target = pingUrl.replace(/\/+$/, '');
    console.log(`[KeepAlive] 24/7 keep-alive monitor active for ${target}`);
    setInterval(async () => {
      try {
        const res = await fetch(`${target}/health`);
        console.log(`[KeepAlive] Pinged ${target}/health - Status: ${res.status}`);
      } catch (err: any) {
        console.warn('[KeepAlive] Ping failed:', err?.message || err);
      }
    }, 10 * 60 * 1000); // Every 10 minutes (Render sleep threshold is 15 minutes)
  }
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
