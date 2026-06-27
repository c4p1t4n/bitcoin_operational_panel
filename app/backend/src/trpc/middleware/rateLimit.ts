import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import { auditedProcedure } from "./audit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

/** Estado do rate limiter — em memória, por instância de processo (mesma limitação do EventBus). */
const requestLog = new Map<string, number[]>();

/**
 * @module rateLimit middleware
 * @description Decorator que limita o número de mutations por usuário numa janela de tempo.
 *
 * PATTERN: Decorator (tRPC middleware)
 * Por que este pattern: limite de taxa é transversal a toda mutation que altera estado;
 * mover para middleware evita repetir a lógica de janela/contagem em cada resolver.
 *
 * Responsabilidade: contar requisições por `currentUser.id` numa janela deslizante de
 * 60s, rejeitar com TOO_MANY_REQUESTS acima de 30 requisições.
 * Não faz: rate limit distribuído entre instâncias — em memória, mesma limitação
 * documentada para o EventBus (sem Redis nesta feature).
 */
const enforceRateLimit = middleware(({ ctx, next }) => {
  const userId = ctx.currentUser?.id ?? "anonymous";
  const now = Date.now();

  const timestamps = (requestLog.get(userId) ?? []).filter((ts) => now - ts < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded: max ${MAX_REQUESTS_PER_WINDOW} requests per ${WINDOW_MS / 1000}s`,
    });
  }

  timestamps.push(now);
  requestLog.set(userId, timestamps);

  return next();
});

export const rateLimitedProcedure = auditedProcedure.use(enforceRateLimit);
