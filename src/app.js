import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import indexerRoutes from './routes/indexer.routes.js';
import queryRoutes from './routes/query.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import userRoutes from './routes/user.routes.js';
import inngestRouter from './routes/inngest.routes.js';
import studioRoutes from './routes/studio.routes.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENTS_URI || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(cookieParser());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy' });
});

// Inngest background event endpoint
app.use('/api/inngest', inngestRouter);

// API Routes
app.use('/api/indexer', indexerRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/user', userRoutes);
app.use('/api/studio', studioRoutes);

export default app;
