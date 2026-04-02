import 'express-async-errors';
import authRoutes from "./routes/auth.js";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dumpsRouter   from './routes/dumps.js';
import policiesRouter from './routes/policies.js';
import statsRouter   from './routes/stats.js';
import renewalDumpsRouter from './routes/renewalDumps.js';
import renewalsRouter from './routes/renewals.js';
import renewalStatsRouter from './routes/renewalStats.js';
import { errorHandler, notFound } from './middleware/errors.js';
import exportRoutes from "./routes/export.js";
import renewalExportRoutes from './routes/renewalExport.js';
import { authMiddleware } from "./middleware/auth.js";
import { env } from './config/env.js';

const app = express();

// Security + parsing

app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use("/api/auth", authRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/renewal-export", authMiddleware, renewalExportRoutes);
app.use(helmet());

// Health check (Railway/Render use this)
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Routes
app.use("/api/dumps", authMiddleware, dumpsRouter);
app.use("/api/policies", authMiddleware, policiesRouter);
app.use('/api/stats', authMiddleware, statsRouter);
app.use('/api/renewal-dumps', authMiddleware, renewalDumpsRouter);
app.use('/api/renewals', authMiddleware, renewalsRouter);
app.use('/api/renewal-stats', authMiddleware, renewalStatsRouter);

// 404 + error handler (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`✅ API running on http://localhost:${env.PORT}`);
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);
});

export default app;
