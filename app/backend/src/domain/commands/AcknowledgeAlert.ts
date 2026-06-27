import { Command } from "./Command";

export const ACKNOWLEDGE_ALERT = "ACKNOWLEDGE_ALERT" as const;

export interface AcknowledgeAlertPayload {
  acknowledgedByUserId: string;
  note?: string;
}

/** Solicita que um alerta seja marcado como tratado. */
export class AcknowledgeAlert extends Command<AcknowledgeAlertPayload> {
  constructor(aggregateId: string, payload: AcknowledgeAlertPayload) {
    super(aggregateId, ACKNOWLEDGE_ALERT, payload);
  }
}
