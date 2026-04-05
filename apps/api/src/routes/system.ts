import { FastifyPluginAsync } from 'fastify';
import * as systemQueries from '../db/queries/system';

const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/system/status
  fastify.get('/status', async () => {
    let dbStatus = 'ok';
    try {
      await fastify.db.execute('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      database: dbStatus,
    };
  });

  // GET /api/system/config
  fastify.get('/config', async () => {
    const configs = await systemQueries.getAll(fastify.db);
    return configs;
  });

  // PUT /api/system/config
  fastify.put<{ Body: { key: string; value: string } }>('/config', async (request, reply) => {
    const { key, value } = request.body;
    if (!key || value === undefined) {
      return reply.status(400).send({ error: 'key and value are required' });
    }
    await systemQueries.upsert(fastify.db, key, value);
    return { success: true };
  });
};

export default systemRoutes;
