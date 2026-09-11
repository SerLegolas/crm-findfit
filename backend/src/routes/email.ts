import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

const fail = (reply: FastifyReply, what: string) =>
  reply.code(501).send({ error: `[email] ${what} non ancora implementato` });

export async function emailRoutes(app: FastifyZodInstance) {
  app.post('/send', async (_req, reply) => fail(reply, 'POST /send'));
  app.post('/send-bulk', async (_req, reply) => fail(reply, 'POST /send-bulk'));
  app.get('/sync', async (_req, reply) => fail(reply, 'GET /sync'));
  app.post('/test', async (_req, reply) => fail(reply, 'POST /test'));
  app.get('/schedule', async (_req, reply) => fail(reply, 'GET /schedule'));
  app.post('/schedule', async (_req, reply) => fail(reply, 'POST /schedule'));
  app.patch('/schedule/:id', async (_req, reply) => fail(reply, 'PATCH /schedule/:id'));
  app.delete('/schedule/:id', async (_req, reply) => fail(reply, 'DELETE /schedule/:id'));
  app.get('/schedule/run', async (_req, reply) => fail(reply, 'GET /schedule/run'));
}
