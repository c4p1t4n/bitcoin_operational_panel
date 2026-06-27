import { initTRPC } from "@trpc/server";
import type { TrpcContext } from "./context";

/**
 * @module trpc
 * @description Instância raiz do tRPC — única fonte de `router`/`procedure` para todo o app.
 *
 * Responsabilidade: expor `router` e `procedure` base tipados pelo TrpcContext.
 * Não faz: lógica de negócio (routers), autenticação/auditoria/rate-limit (middleware/).
 */
const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;
