import type { ReactNode } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

export interface OperationsTableProps<T> {
  rows: readonly T[];
  columns: readonly string[];
  getRowKey: (row: T, index: number) => string;
  renderRow: (row: T, index: number) => ReactNode;
  emptyMessage?: string;
}

/**
 * @module OperationsTable
 * @description Tabela genérica de operações — reutilizada por qualquer lista de
 * `DomainEvent` (ou subconjunto) que precise de cabeçalho fixo + linhas customizadas.
 * Renderiza sobre o `Table` do MUI; `renderRow` devolve as `TableCell` de cada linha.
 *
 * PATTERN: Render Props
 * Por que este pattern: a tabela não sabe nada sobre o formato das linhas — quem a usa
 * decide o que renderizar em cada `TableRow` via `renderRow`, mantendo a tabela reutilizável
 * para qualquer dado tabular do painel (Open/Closed — novos usos não exigem mudar este
 * componente).
 *
 * Não faz: busca de dados, filtragem, sort/paginação (isso é o `EventHistoryTable` com AG
 * Grid) — recebe `rows` já prontos.
 */
export function OperationsTable<T>({
  rows,
  columns,
  getRowKey,
  renderRow,
  emptyMessage = "No operations yet.",
}: OperationsTableProps<T>) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column}>{column}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)} hover>
                {renderRow(row, index)}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
