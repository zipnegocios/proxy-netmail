import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth';
import accountRoutes from './routes/accounts';
import systemRoutes from './routes/system';
import setupRoutes from './routes/setup';
import activityRoutes from './routes/activity';
import sslRoutes from './routes/ssl';

const server = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

// Plugins
server.register(cors, { origin: config.corsOrigin });
server.register(databasePlugin);
server.register(authPlugin);

// Routes
server.register(accountRoutes, { prefix: '/api/accounts' });
server.register(systemRoutes, { prefix: '/api/system' });
server.register(setupRoutes, { prefix: '/api/accounts' });
server.register(activityRoutes, { prefix: '/api/activity' });
server.register(sslRoutes, { prefix: '/api/ssl' });

// Health check (no auth)
server.get('/api/ping', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

const start = async () => {
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`proxy-netmail API running on port ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
