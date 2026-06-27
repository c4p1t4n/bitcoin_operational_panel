import { DomainEvent } from "./DomainEvent";

export const ALERT_RULE_CREATED = "ALERT_RULE_CREATED" as const;

export interface AlertRuleCreatedPayload {
  name: string;
  description?: string;
  ruleType: string;
  configuration: Record<string, unknown>;
  requestedByUserId: string;
}

/** Uma nova regra de alerta foi solicitada e validada. */
export class AlertRuleCreated extends DomainEvent<AlertRuleCreatedPayload> {
  constructor(aggregateId: string, version: number, payload: AlertRuleCreatedPayload) {
    super(aggregateId, "AlertRule", ALERT_RULE_CREATED, version, payload);
  }
}
