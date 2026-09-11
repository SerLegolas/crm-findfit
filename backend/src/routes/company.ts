import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

const fail = (reply: FastifyReply, what: string) =>
  reply.code(501).send({ error: `[company] ${what} non ancora implementato` });

export async function companyRoutes(app: FastifyZodInstance) {
  app.get('/settings', async (_req, reply) => fail(reply, 'GET /settings'));
  app.patch('/settings', async (_req, reply) => fail(reply, 'PATCH /settings'));
  app.get('/rules', async (_req, reply) => fail(reply, 'GET /rules'));
  app.patch('/rules', async (_req, reply) => fail(reply, 'PATCH /rules'));
}
