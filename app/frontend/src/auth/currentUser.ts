const STORAGE_KEY = "bitcoin-ops:userId";

/**
 * @module auth/currentUser
 * @description Placeholder de "usuário atual" no frontend — espelha o placeholder
 * `x-user-id`/`connectionParams` do backend (não há autenticação real ainda).
 *
 * Responsabilidade: ler/escrever o id do usuário atual em `localStorage`, notificar
 * listeners quando ele muda (para o `WebSocketFeed` reconectar com o novo id).
 * Não faz: validação do id contra o backend — isso acontece no `trpc/context.ts`.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function getCurrentUserId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Define o usuário atual e notifica listeners (ex: para forçar reconexão do WebSocket).
 * @param userId - novo id, ou null para "deslogar"
 */
export function setCurrentUserId(userId: string | null): void {
  if (userId) {
    localStorage.setItem(STORAGE_KEY, userId);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

/**
 * Subscreve a mudanças do usuário atual.
 * @param listener - chamado sempre que `setCurrentUserId` é invocado
 * @returns função de unsubscribe
 */
export function onCurrentUserIdChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
