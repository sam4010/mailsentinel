import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';

import authRouter from './routes/auth.js';
import rulesRouter from './routes/rules.js';
import emailsRouter from './routes/emails.js';
import notificationsRouter from './routes/notifications.js';
import syncRouter from './routes/sync.js';
import settingsRouter from './routes/settings.js';
import overviewRouter from './routes/overview.js';

export function createApp() {
  const app = express();

  // Basic security and request parsing
  app.use(helmet({
    contentSecurityPolicy: false, // Allow PWA assets and inline icons
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/rules', rulesRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/overview', overviewRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'MailSentinel', timestamp: new Date().toISOString() });
  });

  // Serve static files in production
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server Error]:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return app;
}
