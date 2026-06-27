import { Command } from "./Command";

export const CREATE_ALERT_RULE = "CREATE_ALERT_RULE" as const;

export interface CreateAlertRulePayload {
  name: string;
  description?: string;
  ruleType: string;
  configuration: Record<string, unknown>;
  requestedByUserId: string;
}

/** Solicita a criação de uma nova regra de alerta. */
export class CreateAlertRule extends Command<CreateAlertRulePayload> {
  constructor(aggregateId: string, payload: CreateAlertRulePayload) {
    super(aggregateId, CREATE_ALERT_RULE, payload);
  }
}
