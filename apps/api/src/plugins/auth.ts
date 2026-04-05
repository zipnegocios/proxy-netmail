import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { email: string };
    user: { email: string };
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, { secret: config.jwtSecret });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.post<{ Body: { email: string; password: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { email, password } = request.body;

      // Phase 1: simple env-based admin auth
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@proxy-netmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

      if (email !== adminEmail || password !== adminPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({ email }, { expiresIn: '24h' });
      return { token };
    },
  );
});
