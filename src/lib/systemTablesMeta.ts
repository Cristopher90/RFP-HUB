import "server-only";
import { prisma } from "@/lib/prisma";
import { IMMUTABLE_TABLES, READONLY_COLUMNS, SYSTEM_TABLES } from "@/lib/systemTables";

// Generic metadata and row operations for the Super Administrator's table
// editor, read straight from the database catalog (columns, primary keys and
// foreign keys with their ON DELETE rule) so it always matches the real
// schema. Identifiers are only ever taken from this catalog / the table
// registry, never from user input, before being quoted into SQL.

export type ColumnMeta = {
  name: string;
  kind: "text" | "int" | "float" | "boolean" | "timestamp" | "json" | "enum" | "array";
  nullable: boolean;
  enumValues: string[]; // enum, or the element type of an enum array
  elementType: string | null; // array columns: the SQL element type name
  udtName: string; // enum columns: the SQL enum type name
  editable: boolean;
};

export type DeleteRule = "cascade" | "setnull" | "restrict" | "default";
export type FkEdge = {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
  rule: DeleteRule;
};

export type TableMeta = {
  table: string;
  pk: string | null; // single-column primary key, or null (not editable)
  columns: ColumnMeta[];
  immutable: boolean;
};

const IDENT = /^[A-Za-z0-9_]+$/;
function q(identifier: string) {
  if (!IDENT.test(identifier)) throw new Error(`Invalid identifier: ${identifier}`);
  return `"${identifier}"`;
}

let fkCache: FkEdge[] | null = null;
let enumCache: Map<string, string[]> | null = null;
const metaCache = new Map<string, TableMeta>();

const RULES: Record<string, DeleteRule> = { c: "cascade", n: "setnull", d: "default", r: "restrict", a: "restrict" };

export async function allForeignKeys(): Promise<FkEdge[]> {
  if (fkCache) return fkCache;
  const rows = await prisma.$queryRawUnsafe<
    { child_table: string; child_column: string; parent_table: string; parent_column: string; rule: string }[]
  >(`
    SELECT cl.relname AS child_table, att.attname AS child_column,
           fcl.relname AS parent_table, fatt.attname AS parent_column,
           con.confdeltype::text AS rule
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_class fcl ON fcl.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = con.confkey[1]
    WHERE con.contype = 'f' AND n.nspname = 'public' AND array_length(con.conkey, 1) = 1
  `);
  fkCache = rows.map((r) => ({
    childTable: r.child_table,
    childColumn: r.child_column,
    parentTable: r.parent_table,
    parentColumn: r.parent_column,
    rule: RULES[r.rule] ?? "restrict",
  }));
  return fkCache;
}

async function enumValues(): Promise<Map<string, string[]>> {
  if (enumCache) return enumCache;
  const rows = await prisma.$queryRawUnsafe<{ typname: string; enumlabel: string }[]>(
    `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid ORDER BY e.enumsortorder`,
  );
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.typname, [...(map.get(r.typname) ?? []), r.enumlabel]);
  enumCache = map;
  return map;
}

export async function getTableMeta(table: string): Promise<TableMeta> {
  const cached = metaCache.get(table);
  if (cached) return cached;
  q(table);
  const [cols, pks, enums] = await Promise.all([
    prisma.$queryRawUnsafe<{ column_name: string; data_type: string; udt_name: string; is_nullable: string }[]>(
      `SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      table,
    ),
    prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1`,
      table,
    ),
    enumValues(),
  ]);
  const pk = pks.length === 1 ? pks[0].column_name : null;
  const immutable = IMMUTABLE_TABLES.includes(table);
  const columns: ColumnMeta[] = cols.map((c) => {
    let kind: ColumnMeta["kind"] = "text";
    let enumVals: string[] = [];
    let elementType: string | null = null;
    switch (c.data_type) {
      case "integer":
      case "bigint":
      case "smallint":
        kind = "int";
        break;
      case "double precision":
      case "numeric":
      case "real":
        kind = "float";
        break;
      case "boolean":
        kind = "boolean";
        break;
      case "jsonb":
      case "json":
        kind = "json";
        break;
      case "USER-DEFINED":
        kind = "enum";
        enumVals = enums.get(c.udt_name) ?? [];
        break;
      case "ARRAY":
        kind = "array";
        elementType = c.udt_name.replace(/^_/, "");
        enumVals = enums.get(elementType) ?? [];
        break;
      default:
        kind = c.data_type.startsWith("timestamp") ? "timestamp" : "text";
    }
    return {
      name: c.column_name,
      kind,
      nullable: c.is_nullable === "YES",
      enumValues: enumVals,
      elementType,
      udtName: c.udt_name,
      editable: !immutable && pk !== null && c.column_name !== pk && !READONLY_COLUMNS.includes(c.column_name),
    };
  });
  const meta = { table, pk, columns, immutable };
  metaCache.set(table, meta);
  return meta;
}

// ---- Row access ------------------------------------------------------------

export type Row = Record<string, unknown>;

export async function fetchRow(meta: TableMeta, id: string): Promise<Row | null> {
  if (!meta.pk) return null;
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT * FROM ${q(meta.table)} WHERE ${q(meta.pk)} = $1`,
    id,
  );
  return rows[0] ?? null;
}

// JSON-safe copy of a row for the audit log (dates as ISO strings, credential
// hashes redacted).
export function auditSnapshot(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = READONLY_COLUMNS.includes(key) && value ? "[redacted]" : JSON.parse(JSON.stringify(value ?? null));
  }
  return out;
}

// Casts a form string into the column's SQL type. Returns the SQL fragment
// for parameter number `n` (or NULL) and the parameter to bind, if any.
export function castFor(col: ColumnMeta, raw: string | null, n: number): { sql: string; param?: string } {
  if (raw === null) return { sql: "NULL" };
  switch (col.kind) {
    case "int":
      return { sql: `$${n}::bigint`, param: raw.trim() };
    case "float":
      return { sql: `$${n}::float8`, param: raw.trim() };
    case "boolean":
      return { sql: `$${n}::boolean`, param: raw === "true" ? "true" : "false" };
    case "timestamp":
      return { sql: `$${n}::timestamp`, param: raw.trim() };
    case "json":
      return { sql: `$${n}::jsonb`, param: raw };
    case "enum":
      return { sql: `$${n}::${q(col.udtName)}`, param: raw };
    case "array": {
      const element = col.enumValues.length > 0 ? q(col.elementType!) : "text";
      return {
        sql: `(CASE WHEN $${n} = '' THEN ARRAY[]::${element}[] ELSE string_to_array($${n}, ',')::${element}[] END)`,
        param: raw.replace(/\s*,\s*/g, ","),
      };
    }
    default:
      return { sql: `$${n}::text`, param: raw };
  }
}

// ---- Relations -------------------------------------------------------------

export type ChildRelation = {
  table: string;
  column: string;
  rule: DeleteRule;
  count: number;
};
export type ParentRelation = { table: string; column: string; viaColumn: string; value: string };

export function tableKeyOf(label: string): string | null {
  return SYSTEM_TABLES.find((t) => t.label === label)?.key ?? null;
}

// Rows in other tables that point at this row, and the rows this row points to.
export async function relationsOf(meta: TableMeta, row: Row) {
  const edges = await allForeignKeys();
  const counted = await Promise.all(
    edges
      .filter((e) => e.parentTable === meta.table && row[e.parentColumn] !== null && row[e.parentColumn] !== undefined)
      .map(async (edge) => {
        const result = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM ${q(edge.childTable)} WHERE ${q(edge.childColumn)} = $1`,
          String(row[edge.parentColumn]),
        );
        return { table: edge.childTable, column: edge.childColumn, rule: edge.rule, count: Number(result[0]?.n ?? 0) };
      }),
  );
  const children: ChildRelation[] = counted.filter((c) => c.count > 0);
  const parents: ParentRelation[] = [];
  for (const edge of edges.filter((e) => e.childTable === meta.table)) {
    const value = row[edge.childColumn];
    if (value === null || value === undefined) continue;
    parents.push({ table: edge.parentTable, column: edge.parentColumn, viaColumn: edge.childColumn, value: String(value) });
  }
  return { children, parents };
}

export type DeleteAnalysis = {
  cascades: Record<string, number>; // rows that will also be deleted, by table
  setNull: Record<string, number>; // "Table.column" -> rows that will be unlinked
  blockers: { table: string; column: string; count: number; sampleIds: string[] }[];
};

// What deleting these rows would do across the database, following ON DELETE
// CASCADE chains. Anything that would be blocked (RESTRICT / NO ACTION) is
// reported with sample ids so the user can go and clear those rows first.
export async function analyzeDelete(table: string, ids: string[]): Promise<DeleteAnalysis> {
  const edges = await allForeignKeys();
  const analysis: DeleteAnalysis = { cascades: {}, setNull: {}, blockers: [] };
  const visited = new Map<string, Set<string>>();
  visited.set(table, new Set(ids));
  const queue: { table: string; ids: string[] }[] = [{ table, ids }];
  let guard = 0;
  while (queue.length > 0 && guard++ < 200) {
    const current = queue.shift()!;
    // The relations of one table are independent: look them all up at once.
    const found = await Promise.all(
      edges
        .filter((e) => e.parentTable === current.table)
        .map(async (edge) => {
          // Only primary-key parents are followed (every relation in this schema).
          const childMeta = await getTableMeta(edge.childTable);
          if (!childMeta.pk) return { edge, rows: [] as { id: string }[] };
          const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `SELECT ${q(childMeta.pk)}::text AS id FROM ${q(edge.childTable)} WHERE ${q(edge.childColumn)}::text = ANY($1::text[])`,
            current.ids,
          );
          return { edge, rows };
        }),
    );
    for (const { edge, rows } of found) {
      if (rows.length === 0) continue;
      if (edge.rule === "cascade") {
        const seen = visited.get(edge.childTable) ?? new Set<string>();
        const fresh = rows.map((r) => r.id).filter((id) => !seen.has(id));
        if (fresh.length === 0) continue;
        fresh.forEach((id) => seen.add(id));
        visited.set(edge.childTable, seen);
        analysis.cascades[edge.childTable] = (analysis.cascades[edge.childTable] ?? 0) + fresh.length;
        queue.push({ table: edge.childTable, ids: fresh });
      } else if (edge.rule === "setnull" || edge.rule === "default") {
        const key = `${edge.childTable}.${edge.childColumn}`;
        analysis.setNull[key] = (analysis.setNull[key] ?? 0) + rows.length;
      } else {
        analysis.blockers.push({
          table: edge.childTable,
          column: edge.childColumn,
          count: rows.length,
          sampleIds: rows.slice(0, 5).map((r) => r.id),
        });
      }
    }
  }
  return analysis;
}
