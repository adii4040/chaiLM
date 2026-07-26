import express from 'express';
import indexerRoutes from './routes/indexer.routes.js';
import queryRoutes from './routes/query.routes.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy' });
});

app.use('/api/indexer', indexerRoutes);
app.use('/api/query', queryRoutes);

export default app;
