import type { Alert, User } from "../types";

/**
 * @module PermissionSpec
 * @description Regras de autorização reutilizáveis entre backend (guarda do CommandBus) e frontend (exibição de UI).
 *
 * PATTERN: Specification
 * Por que este pattern: cada regra é uma função pura testável isoladamente; novas regras entram
 * como novos métodos estáticos, sem modificar as existentes (Open/Closed).
 *
 * Responsabilidade: decidir se uma ação é permitida dado um User (e, quando aplicável, o recurso afetado).
 * Não faz: autenticação, carregamento de User/Alert do banco — isso é responsabilidade do caller.
 */
export class PermissionSpec {
  /** ADMIN e OPERATOR podem criar regras de alerta; VIEWER não. */
  static canCreateAlert(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OPERATOR";
  }

  /**
   * ADMIN sempre pode confirmar. OPERATOR só pode confirmar alertas que não estão
   * atribuídos a outro usuário, ou que estão atribuídos a ele mesmo.
   */
  static canAcknowledgeAlert(user: User, alert: Alert): boolean {
    if (user.role === "ADMIN") return true;
    if (user.role !== "OPERATOR") return false;
    return !alert.assignedToUserId || alert.assignedToUserId === user.id;
  }

  /** Qualquer usuário autenticado pode visualizar o log de operações. */
  static canViewOperationsLog(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OPERATOR" || user.role === "VIEWER";
  }
}
