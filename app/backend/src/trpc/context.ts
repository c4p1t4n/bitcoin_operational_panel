import type { IncomingMessage } from "node:http";
import { eq } from "drizzle-orm";
import { users } from "../../../infra/schema";
import type { Database } from "../db";
import type { Role, User } from "../domain/types";
import type { AppContext } from "../bootstrap";

/**
 * @module context
 * @description Constrói o contexto tRPC para cada requisição (HTTP) ou conexão (WS).
 *
 * Responsabilidade: resolver o usuário atual a partir do request, expor `commandBus` e
 * `eventBus` (vindos do AppContext do bootstrap) aos procedures.
 * Não faz: autenticação real — placeholder até existir um sistema de auth (ver plan.md,
 * Decisão 3). Lê `x-user-id` do header e busca o usuário em `users`; nenhuma verificação
 * de senha/sessão/token é feita.
 */

export interface TrpcContext {
  db: Database;
  commandBus: AppContext["commandBus"];
  eventBus: AppContext["eventBus"];
  currentUser: User | null;
}

/**
 * Resolve o usuário atual a partir do header `x-user-id`.
 *
 * @param db - cliente Drizzle
 * @param req - request HTTP ou WS (ambos expõem `.headers`)
 * @returns User se o header está presente e corresponde a um usuário ativo, senão null
 */
async function resolveCurrentUser(
  db: Database,
  req: IncomingMessage
): Promise<User | null> {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") return null;

  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !row.isActive) return null;

  return { id: row.id, role: row.role as Role };
}

/**
 * Factory de `createContext` para os adapters HTTP e WS do tRPC.
 *
 * @param db - cliente Drizzle
 * @param app - AppContext produzido por `bootstrap()`
 */
export function createContextFactory(db: Database, app: AppContext) {
  return async function createContext({ req }: { req: IncomingMessage }): Promise<TrpcContext> {
    const currentUser = await resolveCurrentUser(db, req);
    return {
      db,
      commandBus: app.commandBus,
      eventBus: app.eventBus,
      currentUser,
    };
  };
}
