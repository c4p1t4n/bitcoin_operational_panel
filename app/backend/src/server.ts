import "dotenv/config";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import { db, checkDatabaseConnection, closeDatabaseConnection } from "./db";
import { bootstrap } from "./bootstrap";
import { createContextFactory } from "./trpc/context";
import { appRouter } from "./trpc/routers";

/**
 * @module server
 * @description Entrypoint do processo — liga bootstrap (domínio) ao tRPC sobre HTTP+WS.
 *
 * Responsabilidade: subir o HTTP server (mutations/queries) e o WS server
 * (subscriptions), compartilhando o mesmo `appRouter` e `createContext`.
 * Não faz: lógica de domínio (bootstrap.ts), validação de input (routers).
 */
const PORT = Number(process.env.PORT ?? 4000);

async function main(): Promise<void> {
  await checkDatabaseConnection();

  const app = await bootstrap(db);
  const createContext = createContextFactory(db, app);

  const httpServer = createHTTPServer({
    router: appRouter,
    createContext,
  });

  const wss = new WebSocketServer({ server: httpServer });
  const wsHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext,
  });

  httpServer.listen(PORT);
  console.log(`tRPC server listening on http://localhost:${PORT}`);

  const shutdown = async () => {
    console.log("Shutting down...");
    wsHandler.broadcastReconnectNotification();
    wss.close();
    httpServer.close();
    await app.ruleEngine.shutdown();
    await app.ruleDefinitionProjector.stop();
    await closeDatabaseConnection();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error during server startup:", err);
  process.exit(1);
});
