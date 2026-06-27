import type { DomainEvent } from "../../domain";
import { operationsLog } from "../../../../infra/schema";
import { middleware } from "../trpc";
import { protectedProcedure } from "./auth";

/**
 * @module audit middleware
 * @description Decorator que grava em `operations_log` toda mutation que produziu eventos.
 *
 * PATTERN: Decorator (tRPC middleware)
 * Por que este pattern: auditoria é transversal a toda mutation que muda estado; manter
 * fora do resolver evita repetir a lógica de log em cada router (Open/Closed).
 *
 * Responsabilidade: após a mutation resolver, se o retorno for um array de DomainEvent
 * não vazio, inserir uma row em `operations_log` referenciando o primeiro evento.
 * Não faz: persistência dos eventos em si (EventStore já fez isso antes do middleware
 * rodar, já que o resolver chama `commandBus.dispatch` e só então retorna).
 *
 * Limitação conhecida: assume que toda mutation auditada retorna `DomainEvent[]`
 * (convenção usada pelos resolvers em `alerts.router.ts`).
 */
const auditMutation = middleware(async ({ ctx, path, type, next }) => {
  const result = await next();

  if (type === "mutation" && result.ok) {
    const events = result.data as DomainEvent[] | undefined;
    const event = events?.[0];

    if (event) {
      try {
        await ctx.db.insert(operationsLog).values({
          eventId: event.id,
          timestamp: event.occurredAt,
          category: event.aggregateType,
          eventName: event.eventType,
          summary: `${path} → ${event.eventType} (${ctx.currentUser?.id ?? "unknown"})`,
          linkId: event.aggregateId,
        });
      } catch (err) {
        console.error(`audit middleware: failed to log operation for ${path}:`, err);
      }
    }
  }

  return result;
});

export const auditedProcedure = protectedProcedure.use(auditMutation);
