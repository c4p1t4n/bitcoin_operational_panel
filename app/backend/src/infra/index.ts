export { EventStore, OptimisticConcurrencyError } from "./EventStore";
export type { IEventStore } from "./EventStore";

export { EventBus } from "./EventBus";
export type { IEventBus, EventBusSubscriber } from "./EventBus";

export {
  CommandBus,
  CommandNotFoundError,
  PermissionError,
} from "./CommandBus";
export type { ICommandDispatcher, CommandHandler } from "./CommandBus";

export { CreateAlertRuleHandler } from "./handlers/CreateAlertRuleHandler";
export { AcknowledgeAlertHandler } from "./handlers/AcknowledgeAlertHandler";
export { UpdatePeerStatusHandler } from "./handlers/UpdatePeerStatusHandler";
export { TriggerAlertHandler } from "./handlers/TriggerAlertHandler";

export { RuleEngine } from "./RuleEngine";

export type { Rule, RuleCondition, RuleAction } from "./rules/Rule";
export type { ConditionMatcher } from "./rules/ConditionMatcher";
export { AlertRuleBuilder } from "./rules/AlertRuleBuilder";
export { FeeSpikeMatcher } from "./rules/matchers/FeeSpikeMatcher";
export { TransactionSizeMatcher } from "./rules/matchers/TransactionSizeMatcher";
export { PeerCountMatcher } from "./rules/matchers/PeerCountMatcher";

export { DrizzleRuleDefinitionRepository } from "./rules/RuleDefinitionRepository";
export type { RuleDefinitionRepository, RuleDefinitionRow } from "./rules/RuleDefinitionRepository";
export { RuleDefinitionProjector } from "./rules/RuleDefinitionProjector";
export { RuleDefinitionCompiler, RuleDefinitionCompilationError } from "./rules/RuleDefinitionCompiler";
