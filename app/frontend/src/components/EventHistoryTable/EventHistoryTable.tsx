import { useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ValueFormatterParams } from "ag-grid-community";
import { useEventHistory } from "../../hooks/useEventHistory";
import type { DomainEventView } from "../../domain/events";

/**
 * @module EventHistoryTable
 * @description Tabela de histórico de eventos com AG Grid — ordenação, filtro de coluna e
 * paginação sobre os `DomainEventView`.
 *
 * PATTERN: Adapter sobre uma lib de tabela (AG Grid) + Dependency Inversion na fonte de dados
 * Por que este pattern: a capacidade rica (sort/filter/paginate) vem pronta do AG Grid; o
 * componente só mapeia `DomainEventView` → colunas. A origem dos dados vem do
 * `useEventHistory` (abstração), não acoplada ao `WebSocketFeed` nem ao futuro `events.list`.
 *
 * Responsabilidade: definir as colunas, formatar valores para exibição e renderizar o grid
 * dentro de um `Card` MUI.
 * Não faz: busca de dados (useEventHistory), nem mutações — é somente leitura.
 */

const PAGE_SIZE = 25;

/** Formata `occurredAt` (Date) para hora local legível. */
function formatTime(params: ValueFormatterParams<DomainEventView, Date>): string {
  return params.value ? params.value.toLocaleString() : "";
}

/** Resumo de uma linha do payload — primeiros campos, para não estourar a célula. */
function summarizePayload(payload: unknown): string {
  if (payload === null || typeof payload !== "object") return String(payload ?? "");
  const entries = Object.entries(payload as Record<string, unknown>).slice(0, 3);
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}

const COLUMN_DEFS: ColDef<DomainEventView>[] = [
  {
    headerName: "Time",
    field: "occurredAt",
    valueFormatter: formatTime,
    sort: "desc",
    minWidth: 180,
  },
  { headerName: "Event type", field: "eventType", minWidth: 200 },
  { headerName: "Aggregate type", field: "aggregateType", minWidth: 160 },
  {
    headerName: "Aggregate id",
    field: "aggregateId",
    valueFormatter: (p) => (p.value ? `${String(p.value).slice(0, 8)}…` : ""),
    minWidth: 130,
  },
  { headerName: "Version", field: "version", maxWidth: 110 },
  {
    headerName: "Summary",
    colId: "summary",
    valueGetter: (p) => summarizePayload(p.data?.payload),
    flex: 1,
    minWidth: 240,
    sortable: false,
  },
];

const DEFAULT_COL_DEF: ColDef<DomainEventView> = {
  sortable: true,
  filter: true,
  resizable: true,
};

export function EventHistoryTable() {
  const { rows, status, source } = useEventHistory();

  // Referência estável das colunas — recriar a cada render reinicia o estado do grid.
  const columnDefs = useMemo(() => COLUMN_DEFS, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="h2" component="h2">
            Event history
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={`${rows.length} events`}
              color="primary"
              variant="outlined"
            />
            <Chip
              size="small"
              label={source === "live" ? "live buffer" : "persisted"}
              color={status === "open" ? "success" : "default"}
              variant="outlined"
            />
          </Stack>
        </Stack>

        <Box className="ag-theme-quartz-dark" sx={{ height: 420, width: "100%" }}>
          <AgGridReact<DomainEventView>
            rowData={rows as DomainEventView[]}
            columnDefs={columnDefs}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={(params) => params.data.id}
            pagination
            paginationPageSize={PAGE_SIZE}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            overlayNoRowsTemplate="No events received yet."
            animateRows
          />
        </Box>
      </CardContent>
    </Card>
  );
}
