import { TRPCError } from "@trpc/server";
import { middleware, publicProcedure } from "../trpc";

/**
 * @module auth middleware
 * @description Decorator que exige um `currentUser` resolvido no contexto.
 *
 * PATTERN: Decorator (tRPC middleware)
 * Por que este pattern: a verificação de "usuário autenticado" é transversal a toda
 * mutation que altera estado; encapsular como middleware evita repetir o check em cada
 * procedure (Open/Closed — novos procedures protegidos só precisam compor `protectedProcedure`).
 *
 * Responsabilidade: rejeitar com UNAUTHORIZED se `ctx.currentUser` é null; popular o
 * contexto downstream com `currentUser` não-nulo (estreita o tipo para os procedures).
 * Não faz: autorização granular por role/recurso (PermissionSpec, já aplicada no CommandBus).
 */
const requireAuth = middleware(({ ctx, next }) => {
  if (!ctx.currentUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or invalid x-user-id header" });
  }

  return next({
    ctx: {
      ...ctx,
      currentUser: ctx.currentUser,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);
