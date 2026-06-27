import { DomainEvent } from "./DomainEvent";

export const ALERT_TRIGGERED = "ALERT_TRIGGERED" as const;

export interface AlertTriggeredPayload {
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description?: string;
  sourceEventId: string;
}

/** Condição de uma regra foi satisfeita — um alerta foi criado. */
export class AlertTriggered extends DomainEvent<AlertTriggeredPayload> {
  constructor(aggregateId: string, version: number, payload: AlertTriggeredPayload) {
    super(aggregateId, "Alert", ALERT_TRIGGERED, version, payload);
  }
}
