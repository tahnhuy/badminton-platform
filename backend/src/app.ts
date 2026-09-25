import express, { Request, Response } from 'express';
import cors from 'cors';
import adminUserRoutes from './routes/admin/adminUserRoutes';
import adminFacilityRoutes from './routes/admin/adminFacilityRoutes';
import adminGlobalSearchRoutes from './routes/admin/adminGlobalSearchRoutes';
import { errorHandler } from './middleware/error.middleware';

export const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Badminton Platform API is running' });
});

// Admin Routes
app.use('/api/v1/admin/users', adminUserRoutes);
app.use('/api/v1/admin/facilities', adminFacilityRoutes);
app.use('/api/v1/admin/global-search', adminGlobalSearchRoutes);

// Centralized Error Handling
app.use(errorHandler);

export default app;
