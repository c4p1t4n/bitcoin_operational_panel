import type {
  Command,
  DomainEvent,
  AcknowledgeAlert,
  CreateAlertRule,
  UpdatePeerStatus,
} from "../domain";
import { PermissionSpec } from "../domain/specs/PermissionSpec";
import type { User } from "../domain/types";
import type { IEventStore } from "./EventStore";
import type { IEventBus } from "./EventBus";

/**
 * @module CommandBus
 * @description Orquestrador central de comandos — dispatch, permissões, handlers, persistência.
 *
 * PATTERN: Command Bus + Strategy
 * Por que este pattern: single entry point para todas as mudanças de estado; separa
 * validação (permissões, payload) de execução (handlers); permite auditoria centralizada.
 *
 * Responsabilidade: rotear commands para handlers, validar PermissionSpec, chamar
 * EventStore.append, propagar OptimisticConcurrencyError para o caller.
 * Não faz: persistência de eventos (EventStore), publicação (EventBus, delegada ao EventStore).
 *
 * Dependências injetadas:
 * - eventStore: para persistir eventos do handler
 * - eventBus: passado para handlers que precisam, mas geralmente não usado diretamente
 * - getCurrentUser: função que retorna User autenticado
 */

export type CommandHandler<C extends Command = Command> = {
  readonly commandType: string;
  handle(command: C): Promise<DomainEvent[]>;
};

export class CommandNotFoundError extends Error {
  constructor(commandType: string) {
    super(`No handler registered for command type: ${commandType}`);
    this.name = "CommandNotFoundError";
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

export interface ICommandDispatcher {
  dispatch(command: Command, actingUser?: User): Promise<DomainEvent[]>;
}

export class CommandBus implements ICommandDispatcher {
  private handlers: Map<string, CommandHandler> = new Map();

  constructor(
    private readonly eventStore: IEventStore,
    private readonly eventBus: IEventBus,
    private readonly getCurrentUser: () => User | null
  ) {}

  /**
   * Registra um handler para um tipo de comando específico.
   * Deve ser chamado durante bootstrap/inicialização, antes de dispatch.
   *
   * @param handler - implementação do CommandHandler
   * @throws se handler.commandType já está registrado
   */
  register(handler: CommandHandler): void {
    if (this.handlers.has(handler.commandType)) {
      throw new Error(
        `Handler already registered for ${handler.commandType}`
      );
    }
    this.handlers.set(handler.commandType, handler);
  }

  /**
   * Dispatch de comando — roteia para handler, valida permissões, persiste eventos.
   * Fluxo: validar usuário → validar permissão → encontrar handler →
   * executar handler → validar eventos → persistir → retornar.
   *
   * @param command - comando a executar
   * @param actingUser - usuário a usar na validação de permissão, sobrescrevendo o
   * `getCurrentUser` injetado no construtor. Usado por callers que servem múltiplos
   * usuários a partir de uma única instância de CommandBus (ex: tRPC, onde cada
   * requisição tem seu próprio usuário autenticado, ao contrário do RuleEngine que
   * sempre despacha como ator de sistema).
   * @returns array de DomainEvents produzidos pelo handler
   * @throws CommandNotFoundError - se não há handler registrado
   * @throws PermissionError - se usuário não tem permissão
   * @throws OptimisticConcurrencyError - se versão do agregado mudou (do EventStore)
   */
  async dispatch(command: Command, actingUser?: User): Promise<DomainEvent[]> {
    const user = actingUser ?? this.getCurrentUser();
    if (!user) {
      throw new PermissionError("User not authenticated");
    }

    // Validar permissões baseadas no tipo de comando
    this.validatePermissions(command, user);

    // Encontrar handler
    const handler = this.handlers.get(command.commandType);
    if (!handler) {
      throw new CommandNotFoundError(command.commandType);
    }

    // Executar handler
    const events = await handler.handle(command);

    // Persistir eventos (EventStore faz a publicação)
    if (events.length > 0) {
      await this.eventStore.append(command, events);
    }

    return events;
  }

  /**
   * Valida se o usuário atual tem permissão para executar o comando.
   * Usa PermissionSpec para regras de autorização.
   *
   * @param command - comando a validar
   * @param user - usuário atual
   * @throws PermissionError - se sem permissão
   */
  private validatePermissions(command: Command, user: User): void {
    switch (command.commandType) {
      case "CREATE_ALERT_RULE":
        if (!PermissionSpec.canCreateAlert(user)) {
          throw new PermissionError(
            "User does not have permission to create alert rules"
          );
        }
        break;

      case "ACKNOWLEDGE_ALERT":
        // Handlers podem fazer validação de detail mais específica (ex: alert ownership)
        // Aqui só validamos permissão geral
        if (!(user.role === "ADMIN" || user.role === "OPERATOR")) {
          throw new PermissionError(
            "User does not have permission to acknowledge alerts"
          );
        }
        break;

      case "UPDATE_PEER_STATUS":
        if (!PermissionSpec.canCreateAlert(user)) {
          throw new PermissionError(
            "User does not have permission to update peer status"
          );
        }
        break;

      case "TRIGGER_ALERT":
        // Originado pelo RuleEngine (ator de sistema) ou por um ADMIN/OPERATOR manual.
        if (!PermissionSpec.canCreateAlert(user)) {
          throw new PermissionError(
            "User does not have permission to trigger alerts"
          );
        }
        break;

      default:
        // Handlers customizados podem não ter permissão centralizada
        // apenas passam por aqui
        break;
    }
  }
}
