import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Pool } from 'mysql2/promise';
import pool from '../db/connection';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
