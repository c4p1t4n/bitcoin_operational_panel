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
 * Decisão 3). Lê o id do usuário do header `x-user-id` (HTTP) ou de `connectionParams`
 * (WS — navegadores não permitem headers customizados no handshake de WebSocket, por
 * isso o client WS usa `createWSClient({ connectionParams })` em vez de headers);
 * nenhuma verificação de senha/sessão/token é feita.
 */

export interface TrpcContext {
  db: Database;
  commandBus: AppContext["commandBus"];
  eventBus: AppContext["eventBus"];
  currentUser: User | null;
}

/**
 * Resolve o id do usuário a partir do header `x-user-id` (HTTP) ou de `connectionParams.userId`
 * (WS, populado por `createWSClient({ connectionParams })` no client).
 *
 * @param req - request HTTP ou WS (ambos expõem `.headers`)
 * @param connectionParams - presente apenas em conexões WS
 */
function resolveUserId(
  req: IncomingMessage,
  connectionParams: Record<string, string | undefined> | null | undefined
): string | null {
  const fromConnectionParams = connectionParams?.userId;
  if (fromConnectionParams) return fromConnectionParams;

  const fromHeader = req.headers["x-user-id"];
  return typeof fromHeader === "string" ? fromHeader : null;
}

/**
 * Carrega o usuário em `users` a partir do id resolvido.
 *
 * @param db - cliente Drizzle
 * @param userId - id resolvido por `resolveUserId`, ou null
 * @returns User se o id corresponde a um usuário ativo, senão null
 */
async function loadUser(db: Database, userId: string | null): Promise<User | null> {
  if (!userId) return null;

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
  return async function createContext({
    req,
    info,
  }: {
    req: IncomingMessage;
    info?: { connectionParams?: Record<string, string | undefined> | null };
  }): Promise<TrpcContext> {
    const userId = resolveUserId(req, info?.connectionParams);
    const currentUser = await loadUser(db, userId);

    return {
      db,
      commandBus: app.commandBus,
      eventBus: app.eventBus,
      currentUser,
    };
  };
}
