import { z } from "zod";
import { observable } from "@trpc/server/observable";
import { CreateAlertRule, AcknowledgeAlert } from "../../domain/commands";
import { ALL_DOMAIN_EVENT_TYPES, type DomainEvent } from "../../domain/events";
import { router, publicProcedure } from "../trpc";
import { rateLimitedProcedure } from "../middleware/rateLimit";

/**
 * @module alerts.router
 * @description Procedures tRPC para o domínio de alertas e regras.
 *
 * Responsabilidade: validar input (zod), traduzir em Command, despachar via
 * `ctx.commandBus` com o usuário autenticado da requisição, e expor o stream de
 * domain events via subscription.
 * Não faz: lógica de negócio (handlers), persistência (EventStore), avaliação de
 * regras (RuleEngine) — este router só traduz HTTP/WS ↔ domínio.
 */

const createAlertRuleInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  ruleType: z.string().min(1).max(100),
  configuration: z.record(z.string(), z.unknown()),
});

const acknowledgeAlertInput = z.object({
  alertId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const alertsRouter = router({
  /** Cria uma nova regra de alerta (requer ADMIN/OPERATOR — PermissionSpec via CommandBus). */
  createAlertRule: rateLimitedProcedure
    .input(createAlertRuleInput)
    .mutation(async ({ ctx, input }) => {
      const command = new CreateAlertRule(crypto.randomUUID(), {
        name: input.name,
        description: input.description,
        ruleType: input.ruleType,
        configuration: input.configuration,
        requestedByUserId: ctx.currentUser.id,
      });

      return ctx.commandBus.dispatch(command, ctx.currentUser);
    }),

  /** Confirma um alerta existente (requer ADMIN, ou OPERATOR dono do alerta — PermissionSpec). */
  acknowledgeAlert: rateLimitedProcedure
    .input(acknowledgeAlertInput)
    .mutation(async ({ ctx, input }) => {
      const command = new AcknowledgeAlert(input.alertId, {
        acknowledgedByUserId: ctx.currentUser.id,
        note: input.note,
      });

      return ctx.commandBus.dispatch(command, ctx.currentUser);
    }),

  /**
   * Stream em tempo real de todos os eventos de domínio conhecidos — alimenta
   * timeline/widgets do frontend. Pública: leitura de eventos não exige autenticação
   * nesta versão (mesma postura de `PermissionSpec.canViewOperationsLog`, que libera VIEWER).
   */
  onBitcoinNetworkEvent: publicProcedure.subscription(({ ctx }) => {
    return observable<DomainEvent>((emit) => {
      const unsubscribers = ALL_DOMAIN_EVENT_TYPES.map((eventType) =>
        ctx.eventBus.subscribe(eventType, async (event) => {
          emit.next(event);
        })
      );

      return () => {
        unsubscribers.forEach((unsubscribe) => {
          unsubscribe().catch((err) =>
            console.error("onBitcoinNetworkEvent: failed to unsubscribe:", err)
          );
        });
      };
    });
  }),
});
