import { query, queryOne } from "./database";
import { isDatabaseAvailable } from "./database";

export interface ColumnMapping {
  field: string;
  column: string;
  isJson?: boolean;
  isArray?: boolean;
}

export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toDbRow(data: Record<string, unknown>, mappings: ColumnMapping[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const map of mappings) {
    const val = data[map.field];
    if (val !== undefined) {
      if (map.isJson) {
        row[map.column] = JSON.stringify(val);
      } else if (map.isArray) {
        row[map.column] = Array.isArray(val) ? val : [val];
      } else {
        row[map.column] = val;
      }
    }
  }
  return row;
}

export function fromDbRow(row: Record<string, unknown>, mappings: ColumnMapping[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const map of mappings) {
    const val = row[map.column];
    if (val !== undefined && val !== null) {
      if (map.isJson && typeof val === "string") {
        try { data[map.field] = JSON.parse(val as string); } catch { data[map.field] = val; }
      } else if (map.isJson && typeof val === "object") {
        data[map.field] = val;
      } else if (map.isArray) {
        data[map.field] = Array.isArray(val) ? val : [];
      } else {
        data[map.field] = val;
      }
    } else {
      data[map.field] = map.isArray ? [] : map.isJson ? {} : undefined;
    }
  }
  return data;
}

export interface PgTableConfig {
  table: string;
  mappings: ColumnMapping[];
  tenantField?: string;
  idField?: string;
}

export async function findAll<T>(config: PgTableConfig, tenantId?: string): Promise<T[]> {
  if (!isDatabaseAvailable()) return [];
  const whereClause = tenantId && config.tenantField ? `WHERE ${config.tenantField} = $1` : "";
  const params = tenantId && config.tenantField ? [tenantId] : [];
  const rows = await query<Record<string, unknown>>(`SELECT * FROM ${config.table} ${whereClause} ORDER BY created_at DESC`, params);
  return rows.map(r => fromDbRow(r, config.mappings) as unknown as T);
}

export async function findById<T>(config: PgTableConfig, id: string): Promise<T | null> {
  if (!isDatabaseAvailable()) return null;
  const idCol = config.idField || "id";
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM ${config.table} WHERE ${idCol} = $1`, [id]);
  return row ? (fromDbRow(row, config.mappings) as unknown as T) : null;
}

export async function create<T>(config: PgTableConfig, data: T, tenantId?: string): Promise<T> {
  if (!isDatabaseAvailable()) return data;
  const rowData = toDbRow(data as unknown as Record<string, unknown>, config.mappings);
  if (tenantId && config.tenantField && !rowData[config.tenantField]) {
    rowData[config.tenantField] = tenantId;
  }
  const columns = Object.keys(rowData);
  const values = Object.values(rowData);
  const placeholders = values.map((_, i) => `$${i + 1}`);
  const returningCols = config.mappings.map(m => m.column).join(", ");
  const result = await queryOne<Record<string, unknown>>(
    `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${returningCols}`,
    values
  );
  return result ? (fromDbRow(result, config.mappings) as unknown as T) : data;
}

export async function update<T>(config: PgTableConfig, id: string, data: Partial<T>): Promise<T | null> {
  if (!isDatabaseAvailable()) return null;
  const rowData = toDbRow(data as unknown as Record<string, unknown>, config.mappings);
  const columns = Object.keys(rowData).filter(c => c !== config.idField && c !== config.tenantField);
  if (columns.length === 0) return findById(config, id);
  const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(", ");
  const values = columns.map(c => rowData[c]);
  const idCol = config.idField || "id";
  const result = await queryOne<Record<string, unknown>>(
    `UPDATE ${config.table} SET ${setClause}, updated_at = NOW() WHERE ${idCol} = $1 RETURNING *`,
    [id, ...values]
  );
  return result ? (fromDbRow(result, config.mappings) as unknown as T) : null;
}

export async function remove(config: PgTableConfig, id: string): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;
  const idCol = config.idField || "id";
  await query(`DELETE FROM ${config.table} WHERE ${idCol} = $1`, [id]);
  return true;
}
