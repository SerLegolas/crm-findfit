import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

const fail = (reply: FastifyReply, what: string) =>
  reply.code(501).send({ error: `[analytics] ${what} non ancora implementato` });

export async function analyticsRoutes(app: FastifyZodInstance) {
  app.get('/dashboard', async (_req, reply) => fail(reply, 'GET /dashboard'));
  app.get('/report', async (_req, reply) => fail(reply, 'GET /report'));
}
