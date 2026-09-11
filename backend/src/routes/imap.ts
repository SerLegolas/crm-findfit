import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

const fail = (reply: FastifyReply, what: string) =>
  reply.code(501).send({ error: `[imap] ${what} non ancora implementato` });

export async function imapRoutes(app: FastifyZodInstance) {
  app.get('/settings', async (_req, reply) => fail(reply, 'GET /settings'));
  app.put('/settings', async (_req, reply) => fail(reply, 'PUT /settings'));
  app.post('/test', async (_req, reply) => fail(reply, 'POST /test'));
}
