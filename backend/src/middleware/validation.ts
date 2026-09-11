import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';

type ZodShape = {
  body?: z.ZodTypeAny;
  querystring?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

/**
 * PreHandler di validazione esplicita con zod (utile quando non si usa lo
 * schema della route). Le route che dichiarano `schema` con zod vengono già
 * validate dal validatorCompiler di fastify-type-provider-zod.
 */
export function validate(schema: ZodShape): preHandlerHookHandler {
  return async function preHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (schema.params) {
        (request as any).params = schema.params.parse((request as any).params);
      }
      if (schema.querystring) {
        (request as any).query = schema.querystring.parse((request as any).query);
      }
      if (schema.body) {
        (request as any).body = schema.body.parse((request as any).body);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Dati non validi', details: err.flatten() });
      }
      throw err;
    }
  };
}
