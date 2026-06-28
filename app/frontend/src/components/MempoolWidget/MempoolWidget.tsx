import { useMemo } from "react";
import { MEMPOOL_FEE_SPIKE, type MemPoolFeeSpikePayload } from "../../domain/events";
import { useDomainEvents } from "../../hooks/useDomainEvents";

/**
 * @module MempoolWidget
 * @description Card com a métrica de mempool mais recente — último `MEMPOOL_FEE_SPIKE`
 * recebido pelo `WebSocketFeed`.
 *
 * Não faz: polling/fetch — é puramente reativo ao stream (se não houver spike desde que a
 * página carregou, mostra estado vazio).
 */
export function MempoolWidget() {
  const { events } = useDomainEvents();

  const latest = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event?.eventType === MEMPOOL_FEE_SPIKE) {
        return { payload: event.payload as MemPoolFeeSpikePayload, occurredAt: event.occurredAt };
      }
    }
    return null;
  }, [events]);

  if (!latest) {
    return (
      <div className="mempool-widget mempool-widget--empty">
        <h3>Mempool fee rate</h3>
        <p>No fee spike observed yet.</p>
      </div>
    );
  }

  return (
    <div className="mempool-widget">
      <h3>Mempool fee rate</h3>
      <p className="mempool-widget__rate">{latest.payload.feeRateSatPerVb.toFixed(1)} sat/vB</p>
      <p className="mempool-widget__delta">
        {latest.payload.deltaPct.toFixed(1)}% above baseline ({latest.payload.baselineSatPerVb.toFixed(1)} sat/vB)
      </p>
      <time dateTime={latest.occurredAt.toISOString()}>{latest.occurredAt.toLocaleTimeString()}</time>
    </div>
  );
}
