import { eq } from "drizzle-orm";
import { ruleDefinitions } from "../../../../infra/schema";
import type { Database } from "../../db";

/**
 * @module RuleDefinitionRepository
 * @description Acesso de leitura/escrita à tabela `rule_definitions`.
 *
 * PATTERN: Repository
 * Por que este pattern: isola o RuleDefinitionProjector e o bootstrap de detalhes do
 * Drizzle/Postgres; `rule_definitions` é um read-model (não o event log), então tem
 * persistência própria em vez de passar pelo EventStore.
 *
 * Responsabilidade: ler regras ativas e inserir novas regras na tabela.
 * Não faz: compilação de `configuration` em `Rule` (RuleDefinitionCompiler), decisão de
 * quando inserir (RuleDefinitionProjector).
 *
 * Dependências injetadas:
 * - db: cliente Drizzle
 */

export interface RuleDefinitionRow {
  id: string;
  name: string;
  description: string | null;
  ruleType: string;
  configuration: Record<string, unknown>;
  isActive: boolean;
}

export interface RuleDefinitionRepository {
  loadActive(): Promise<RuleDefinitionRow[]>;
  insert(row: RuleDefinitionRow): Promise<void>;
}

export class DrizzleRuleDefinitionRepository implements RuleDefinitionRepository {
  constructor(private readonly db: Database) {}

  /**
   * Carrega todas as regras com `is_active = true`, para alimentar `RuleEngine.addRule()`
   * no boot.
   *
   * @returns array de rows ativas
   */
  async loadActive(): Promise<RuleDefinitionRow[]> {
    const rows = await this.db
      .select()
      .from(ruleDefinitions)
      .where(eq(ruleDefinitions.isActive, true));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      ruleType: row.ruleType,
      configuration: row.configuration as Record<string, unknown>,
      isActive: row.isActive ?? true,
    }));
  }

  /**
   * Insere uma nova regra. Chamado pelo RuleDefinitionProjector ao reagir a um
   * AlertRuleCreated.
   *
   * @param row - regra completa, incluindo id (gerado pelo handler que criou o evento)
   * @throws se já existir uma regra com o mesmo `name` (constraint UNIQUE)
   */
  async insert(row: RuleDefinitionRow): Promise<void> {
    await this.db.insert(ruleDefinitions).values({
      id: row.id,
      name: row.name,
      description: row.description,
      ruleType: row.ruleType,
      configuration: row.configuration,
      isActive: row.isActive,
    });
  }
}
