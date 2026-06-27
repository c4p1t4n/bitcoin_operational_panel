import { router } from "../trpc";
import { alertsRouter } from "./alerts.router";

/** Router raiz — agrega todos os sub-routers do app. */
export const appRouter = router({
  alerts: alertsRouter,
});

export type AppRouter = typeof appRouter;
