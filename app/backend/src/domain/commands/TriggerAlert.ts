import { Command } from "./Command";

export const TRIGGER_ALERT = "TRIGGER_ALERT" as const;

export interface TriggerAlertPayload {
  ruleId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description?: string;
  sourceEventId: string;
}

/** Solicita a criação de um alerta a partir de uma regra que casou com um evento de domínio. */
export class TriggerAlert extends Command<TriggerAlertPayload> {
  constructor(aggregateId: string, payload: TriggerAlertPayload) {
    super(aggregateId, TRIGGER_ALERT, payload);
  }
}
