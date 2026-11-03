import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../src/server/routes';
import { initDatabase } from '../src/server/db';

const app = express();

// Enable CORS for all incoming origins
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Initialize database schema and ensure initial admin exists
try {
  initDatabase();
} catch (err) {
  console.error('[Vercel API] Database initialization warning:', err);
}

// Mount apiRouter under both /api and root /
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
