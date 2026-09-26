import "server-only";
import { agentRaw, agentRequest, AgentError, type AgentRef } from "@/lib/agent";

/**
 * Соединение с базой проекта — через агента её сервера (`/db/exec`,
 * `/db/export` в agent/app/dbproxy.py), а не напрямую: у клиента Postgres
 * наружу не смотрит, а агент стоит рядом с ним.
 *
 * Форма повторяет то, чем модули пользовались у postgres.js (`unsafe` →
 * строки с `.count/.columns/.command`), чтобы редактор таблиц, SQL-редактор
 * и правка схемы не переписывались. Транзакции — `exec` с пачкой statements:
 * агент исполняет их в одной транзакции, отдельные round-trip'ы внутри
 * транзакции через туннель не пробрасываются.
 *
 * Параметры уезжают строками (как в text-протоколе postgres.js), поэтому
 * касты в запросах пишутся `($n::text)::тип` — иначе asyncpg на стороне
 * агента пытался бы закодировать строку "5" как integer и отказал бы.
 */
export type SqlParam = string | number | boolean | null | object;
export type SqlColumn = { name: string; type: string };
export type StatementResult = {
  command: string | null;
  columns: SqlColumn[];
  rows: Record<string, unknown>[];
  row_count: number;
  truncated: boolean;
};
export type ExecResult = { statements: StatementResult[]; duration_ms: number; read_only: boolean };
export type ExecOptions = { readOnly?: boolean; timeoutMs?: number; maxRows?: number };

export type Rows = Record<string, unknown>[] & { count: number; columns: SqlColumn[]; command: string | null };

export type ProjectSql = {
  /** Один statement в своей транзакции; строки с `.count` (для DML — число затронутых). */
  unsafe(query: string, params?: SqlParam[]): Promise<Rows>;
  /** Пачка statements в одной транзакции. */
  exec(statements: { sql: string; params?: SqlParam[] }[], opts?: ExecOptions): Promise<ExecResult>;
  /** CSV через COPY … TO STDOUT на стороне агента. */
  exportCsv(query: string, params?: SqlParam[]): Promise<string>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function agentSql(agent: AgentRef, url: string): ProjectSql {
  const exec: ProjectSql["exec"] = async (statements, opts) => {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return agentRequest<ExecResult>(agent, "/db/exec", {
      method: "POST",
      body: {
        url,
        statements: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
        read_only: opts?.readOnly ?? false,
        timeout_ms: timeoutMs,
        max_rows: opts?.maxRows ?? 1000,
      },
      timeoutMs: timeoutMs + 5_000,
    });
  };
  return {
    exec,
    async unsafe(query, params = []) {
      const res = await exec([{ sql: query, params }]);
      const st = res.statements[0];
      const rows = st.rows as Rows;
      rows.count = st.row_count;
      rows.columns = st.columns;
      rows.command = st.command;
      return rows;
    },
    async exportCsv(query, params = []) {
      const { status, text } = await agentRaw(agent, "/db/export", { method: "POST", body: { url, sql: query, params }, timeoutMs: 120_000 });
      if (status !== 200) {
        let detail = `Agent responded ${status}`;
        try {
          const j = JSON.parse(text) as { detail?: unknown };
          if (typeof j.detail === "string") detail = j.detail;
        } catch {
          /* не JSON */
        }
        throw new AgentError(detail, status);
      }
      return text;
    },
  };
}
