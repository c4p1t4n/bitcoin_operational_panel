import TableCell from "@mui/material/TableCell";
import { useDomainEvents } from "../../hooks/useDomainEvents";
import { OperationsTable } from "./OperationsTable";
import type { DomainEventView } from "../../domain/events";

const COLUMNS = ["Time", "Type", "Aggregate", "Version"] as const;

/**
 * @module OperationsView
 * @description Adapta o snapshot do `WebSocketFeed` (lista bruta de `DomainEventView`)
 * para o `OperationsTable` genérico — define colunas e `renderRow` para este caso de uso
 * específico (log de operações), sem acoplar o `OperationsTable` a este formato.
 */
export function OperationsView() {
  const { events } = useDomainEvents();
  const rows = [...events].reverse();

  return (
    <OperationsTable<DomainEventView>
      rows={rows}
      columns={COLUMNS}
      getRowKey={(row) => row.id}
      emptyMessage="No operations received yet."
      renderRow={(row) => (
        <>
          <TableCell>{row.occurredAt.toLocaleTimeString()}</TableCell>
          <TableCell>{row.eventType}</TableCell>
          <TableCell>
            {row.aggregateType} <code>{row.aggregateId.slice(0, 8)}</code>
          </TableCell>
          <TableCell>{row.version}</TableCell>
        </>
      )}
    />
  );
}
