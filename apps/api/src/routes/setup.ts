import { FastifyPluginAsync } from 'fastify';
import type { SetupEvent } from '@proxy-netmail/shared';
import * as setupService from '../services/setup.service';
import * as systemQueries from '../db/queries/system';
import * as activityLog from '../db/queries/activity_log';

const setupRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /:id/setup - SSE stream
  fastify.post<{ Params: { id: string } }>(
    '/:id/setup',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      // Set SSE headers
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

      const emit = (event: SetupEvent) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        // Get certbot email from system config
        const alertEmailRow = await systemQueries.getByKey(
          fastify.db,
          'alert_email',
        );
        const certbotEmail =
          (alertEmailRow && alertEmailRow.value) || 'admin@example.com';

        // Run the setup pipeline
        await setupService.runSetup(id, fastify.db, emit, certbotEmail);
      } catch (error) {
        console.error('[Setup Route] Error:', error);
        // Error already emitted by runSetup
      } finally {
        clearInterval(heartbeat);
        reply.raw.end();
      }
    },
  );

  // POST /:id/stop - Stop proxy
  fastify.post<{ Params: { id: string } }>(
    '/:id/stop',
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

      try {
        // Update account status
        const [result] = await fastify.db.execute(
          'UPDATE accounts SET proxy_status = ? WHERE id = ?',
          ['stopped', id],
        );

        // Get account to remove config
        const account = await fastify.db.execute(
          'SELECT nginx_conf_path FROM accounts WHERE id = ?',
          [id],
        );
        if ((account as any)[0].length > 0) {
          const confPath = (account as any)[0][0].nginx_conf_path;
          if (confPath) {
            const nginxService = await import('../services/nginx.service');
            await nginxService.removeConfig(confPath);
            await nginxService.reloadNginx();
          }
        }

        // Log activity
        await activityLog.insert(fastify.db, {
          account_id: id,
          event_type: 'proxy_stop',
          severity: 'success',
          message: 'Proxy stopped',
        });

        return reply.send({ ok: true });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[Stop Route] Error:', errorMsg);
        return reply.status(500).send({ error: errorMsg });
      }
    },
  );
};

export default setupRoutes;
