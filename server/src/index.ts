import express, { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { runMigrations } from './migrate';
import familyRoutes from './routes/family';
import choreRoutes from './routes/chores';
import logRoutes from './routes/logs';
import goalRoutes from './routes/goals';
import achievementRoutes from './routes/achievements';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import familiesRoutes from './routes/families';
import superadminRoutes from './routes/superadmin';
import { familyMiddleware } from './middleware/family';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(express.json());

// Family lookup / creation (no auth middleware)
app.use('/api/families', familiesRoutes);

// Super-admin (protected by SUPER_ADMIN_KEY env var)
app.use('/api/superadmin', superadminRoutes);

// All family-scoped routes — resolved by familyMiddleware
const familyScopedRouter = Router({ mergeParams: true });
familyScopedRouter.use(familyMiddleware as express.RequestHandler);
familyScopedRouter.use('/family',       familyRoutes);
familyScopedRouter.use('/chores',       choreRoutes);
familyScopedRouter.use('/logs',         logRoutes);
familyScopedRouter.use('/goals',        goalRoutes);
familyScopedRouter.use('/achievements', achievementRoutes);
familyScopedRouter.use('/admin',        adminRoutes);
familyScopedRouter.use('/stats',        statsRoutes);

app.use('/api/f/:familyCode', familyScopedRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

async function start() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
