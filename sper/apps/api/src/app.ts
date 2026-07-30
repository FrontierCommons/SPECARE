import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { errorHandler } from './shared/middleware/error-handler';
import { wireDelivery } from './delivery/wire';
import { authRoutes } from './modules/auth/auth.routes';
import { circleRoutes } from './modules/circles/circles.routes';
import { checkinRoutes } from './modules/checkins/checkins.routes';
import { touchpointRoutes } from './modules/touchpoints/touchpoints.routes';
import { gratitudeRoutes } from './modules/gratitude/gratitude.routes';
import { userRoutes } from './modules/users/users.routes';

/**
 * Build the Fastify app with all routes mounted under /api/v1.
 * Wires the delivery layer into the domain services once, at construction.
 */
export async function buildApp(): Promise<FastifyInstance> {
  wireDelivery();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(circleRoutes);
      await api.register(checkinRoutes);
      await api.register(touchpointRoutes);
      await api.register(gratitudeRoutes);
      await api.register(userRoutes);
    },
    { prefix: '/api/v1' },
  );

  return app;
}
