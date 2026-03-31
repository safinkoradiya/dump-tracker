import dotenv from "dotenv";
dotenv.config();
import 'express-async-errors';
import authRoutes from "./routes/auth.js";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dumpsRouter   from './routes/dumps.js';
import policiesRouter from './routes/policies.js';
import statsRouter   from './routes/stats.js';
import { errorHandler, notFound } from './middleware/errors.js';
import exportRoutes from "./routes/export.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Security + parsing

app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use("/api/auth", authRoutes);
app.use("/api/export", exportRoutes);
app.use(helmet());

// Health check (Railway/Render use this)
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Routes
app.use("/api/dumps", authMiddleware, dumpsRouter);
app.use("/api/policies", authMiddleware, policiesRouter);
app.use('/api/stats',    statsRouter);

// 404 + error handler (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
});

export default app;
