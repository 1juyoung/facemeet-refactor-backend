import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRoutes from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';

const app = express();

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', apiRoutes);

app.use(errorMiddleware);

export default app;
