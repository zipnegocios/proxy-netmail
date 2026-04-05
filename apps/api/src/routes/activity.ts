import { FastifyPluginAsync } from 'fastify';
import * as activityLog from '../db/queries/activity_log';

const activityRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / - Recent activity (all accounts)
  fastify.get('/', async (request, reply) => {
    try {
      const entries = await activityLog.findRecent(fastify.db, 50);
      return reply.send(entries);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[Activity Route] Error:', errorMsg);
      return reply.status(500).send({ error: errorMsg });
    }
  });

  // GET /accounts/:id - Account-specific activity
  fastify.get<{ Params: { id: string } }>(
    '/accounts/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      try {
        const entries = await activityLog.findByAccount(fastify.db, id, 50);
        return reply.send(entries);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[Activity Route] Error:', errorMsg);
        return reply.status(500).send({ error: errorMsg });
      }
    },
  );
};

export default activityRoutes;
