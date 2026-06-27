/**
 * @module domain/types
 * @description Tipos de domínio compartilhados entre DomainEvent, Command e PermissionSpec.
 *
 * Responsabilidade: vocabulário mínimo (User, Role, Alert, AggregateType) usado por toda a camada de domínio.
 * Não faz: persistência, validação de runtime (isso é responsabilidade do CommandBus na Fase 3).
 */

/** Papéis de usuário suportados. Espelha o default `VIEWER` de `app/infra/schema.ts`. */
export type Role = "ADMIN" | "OPERATOR" | "VIEWER";

/** Visão mínima de usuário necessária pelo PermissionSpec — não é a row completa de `users`. */
export interface User {
  id: string;
  role: Role;
}

/** Visão mínima de alerta necessária pelo PermissionSpec — não é a row completa de `alerts`. */
export interface Alert {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  assignedToUserId?: string;
}

/** Tipos de agregado reconhecidos pelo event store (`aggregate_type` em `events`). */
export type AggregateType =
  | "Block"
  | "Transaction"
  | "Alert"
  | "AlertRule"
  | "Peer";
