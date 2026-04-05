import { FastifyPluginAsync } from 'fastify';
import * as sslQueries from '../db/queries/ssl';

const sslRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /:id - Get SSL certificate for account
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      try {
        const cert = await sslQueries.findByAccount(fastify.db, id);
        if (!cert) {
          return reply.status(404).send({ error: 'No SSL certificate found' });
        }
        return reply.send(cert);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[SSL Route] Error:', errorMsg);
        return reply.status(500).send({ error: errorMsg });
      }
    },
  );
};

export default sslRoutes;
