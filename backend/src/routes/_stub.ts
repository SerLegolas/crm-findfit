import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

/** Registra su un'istanza Fastify gli endpoint CRUD di base come stub (501). */
export function notImplemented(app: FastifyZodInstance, resource: string) {
  const fail = (reply: FastifyReply, verb: string, path: string) =>
    reply.code(501).send({ error: `[${resource}] ${verb} ${path} non ancora implementato` });

  app.get('/', async (_req, reply) => fail(reply, 'GET', '/'));
  app.get('/:id', async (_req, reply) => fail(reply, 'GET', '/:id'));
  app.post('/', async (_req, reply) => fail(reply, 'POST', '/'));
  app.patch('/:id', async (_req, reply) => fail(reply, 'PATCH', '/:id'));
  app.delete('/:id', async (_req, reply) => fail(reply, 'DELETE', '/:id'));
}
