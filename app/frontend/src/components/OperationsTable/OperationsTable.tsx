import type { ReactNode } from "react";

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
 *
 * PATTERN: Render Props
 * Por que este pattern: a tabela não sabe nada sobre o formato das linhas — quem a usa
 * decide o que renderizar em cada `<tr>` via `renderRow`, mantendo a tabela reutilizável
 * para qualquer dado tabular do painel (Open/Closed — novos usos não exigem mudar este
 * componente).
 *
 * Não faz: busca de dados, filtragem — recebe `rows` já prontos.
 */
export function OperationsTable<T>({
  rows,
  columns,
  getRowKey,
  renderRow,
  emptyMessage = "No operations yet.",
}: OperationsTableProps<T>) {
  return (
    <table className="operations-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="operations-table__empty">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={getRowKey(row, index)}>{renderRow(row, index)}</tr>
          ))
        )}
      </tbody>
    </table>
  );
}
