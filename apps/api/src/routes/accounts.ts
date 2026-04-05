import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import * as accountQueries from '../db/queries/accounts';

const createSchema = z.object({
  label: z.string().min(1).max(100),
  target_domain: z.string().min(1).max(255),
  imap_upstream: z.string().max(255).optional(),
  smtp_upstream: z.string().max(255).optional(),
  pop_upstream: z.string().max(255).optional(),
  imap_port: z.number().int().positive().optional(),
  smtp_port: z.number().int().positive().optional(),
  pop_port: z.number().int().positive().optional(),
});

const updateSchema = createSchema.partial();

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/accounts
  fastify.get('/', async (request, reply) => {
    const accounts = await accountQueries.findAll(fastify.db);
    return accounts;
  });

  // POST /api/accounts
  fastify.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }
    const account = await accountQueries.create(fastify.db, parsed.data);
    return reply.status(201).send(account);
  });

  // GET /api/accounts/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

    const account = await accountQueries.findById(fastify.db, id);
    if (!account) return reply.status(404).send({ error: 'Account not found' });
    return account;
  });

  // PUT /api/accounts/:id
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const account = await accountQueries.update(fastify.db, id, parsed.data);
    if (!account) return reply.status(404).send({ error: 'Account not found' });
    return account;
  });

  // DELETE /api/accounts/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) return reply.status(400).send({ error: 'Invalid ID' });

    const deleted = await accountQueries.remove(fastify.db, id);
    if (!deleted) return reply.status(404).send({ error: 'Account not found' });
    return { success: true };
  });
};

export default accountRoutes;
