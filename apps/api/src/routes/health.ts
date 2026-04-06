import { FastifyPluginAsync } from 'fastify';
import type { HealthCheck } from '@proxy-netmail/shared';
import * as healthQueries from '../db/queries/health_checks';
import * as healthService from '../services/health.service';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // GET / - All health summaries
  fastify.get('/', async (request, reply) => {
    try {
      const summaries = await healthQueries.findAllSummaries(fastify.db);
      return reply.send(summaries);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('[Health Route] GET / error:', errorMsg);
      return reply.status(500).send({ error: errorMsg });
    }
  });

  // GET /:id - Health check history for account
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      try {
        const checks = await healthQueries.findByAccount(fastify.db, id, 50);
        return reply.send(checks);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[Health Route] GET /:id error:', errorMsg);
        return reply.status(500).send({ error: errorMsg });
      }
    },
  );

  // POST /:id/check - On-demand health check
  fastify.post<{ Params: { id: string } }>(
    '/:id/check',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      try {
        const summary = await healthService.checkAccount(fastify.db, id);
        return reply.send(summary);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[Health Route] POST /:id/check error:', errorMsg);
        if (errorMsg.includes('not found')) {
          return reply.status(404).send({ error: errorMsg });
        }
        return reply.status(500).send({ error: errorMsg });
      }
    },
  );

  // GET /:id/stream - SSE stream of health checks
  fastify.get<{ Params: { id: string } }>(
    '/:id/stream',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const heartbeat = setInterval(
        () => reply.raw.write(': heartbeat\n\n'),
        15000,
      );

      const onCheck = (check: HealthCheck) => {
        reply.raw.write(`data: ${JSON.stringify(check)}\n\n`);
      };

      healthService.healthEmitter.on(`check:${id}`, onCheck);

      request.raw.on('close', () => {
        healthService.healthEmitter.off(`check:${id}`, onCheck);
        clearInterval(heartbeat);
        reply.raw.end();
      });
    },
  );
};

export default healthRoutes;
