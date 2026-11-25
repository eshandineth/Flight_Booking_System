import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express, { Express } from 'express';
import { config } from './config';
import { DbPool } from './db/pool';
import { createAuthRouter } from './routes/auth';
import { createBookingsRouter } from './routes/bookings';
import { createFlightsRouter } from './routes/flights';

export function createApp(pool: DbPool): Express {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ status: 'error' });
    }
  });

  app.use('/api/auth', createAuthRouter(pool));
  app.use('/api/flights', createFlightsRouter(pool));
  app.use('/api/bookings', createBookingsRouter(pool));

  // Serve built React frontend in production / unified deployments
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  }

  return app;
}

