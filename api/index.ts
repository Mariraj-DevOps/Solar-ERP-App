import express, { Request, Response, NextFunction } from 'express';

const app = express();

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

let routesLoaded = false;
let routeLoadError: string | null = null;

async function ensureRoutes() {
  if (routesLoaded) return;
  try {
    const { initDatabase } = await import('../src/server/db');
    initDatabase();
    const { apiRouter } = await import('../src/server/routes');
    app.use('/api', apiRouter);
    app.use('/', apiRouter);
    routesLoaded = true;
  } catch (err: any) {
    routeLoadError = err?.message || String(err);
    console.error('[Vercel API] Failed to load server routes:', err);
    throw err;
  }
}

export default async function handler(req: Request, res: Response) {
  // Always allow health checks without loading heavy or native dependencies
  const path = req.url || '';
  if (path.endsWith('/health') || path.endsWith('/health/')) {
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        hasDbUrl: Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL),
        isVercel: Boolean(process.env.VERCEL),
      },
    });
  }

  try {
    await ensureRoutes();
  } catch (err: any) {
    return res.status(500).json({
      error: 'Backend initialization failed on Vercel Serverless Function',
      details: err?.message || String(err),
      hint: 'Native module better-sqlite3 cannot run in AWS Lambda/Vercel serverless environment.',
    });
  }

  return app(req, res);
}
