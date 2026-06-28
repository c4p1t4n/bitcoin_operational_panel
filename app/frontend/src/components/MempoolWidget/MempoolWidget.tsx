import { useMemo } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
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

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h2" component="h3" gutterBottom>
          Mempool fee rate
        </Typography>

        {!latest ? (
          <Typography variant="body2" color="text.secondary">
            No fee spike observed yet.
          </Typography>
        ) : (
          <>
            <Typography variant="h4" color="primary" fontWeight={700}>
              {latest.payload.feeRateSatPerVb.toFixed(1)} sat/vB
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {latest.payload.deltaPct.toFixed(1)}% above baseline (
              {latest.payload.baselineSatPerVb.toFixed(1)} sat/vB)
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              component="time"
              dateTime={latest.occurredAt.toISOString()}
            >
              {latest.occurredAt.toLocaleTimeString()}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
