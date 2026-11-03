/** Minimal async SQL surface so retrieval runs on op-sqlite (device) and node:sqlite (eval). */
export type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface SqlExecutor {
  all(sql: string, params?: SqlValue[]): Promise<Row[]>;
}

export async function readMeta(exec: SqlExecutor): Promise<Record<string, string>> {
  const rows = await exec.all('SELECT key, value FROM meta');
  return Object.fromEntries(rows.map((r) => [String(r.key), String(r.value)]));
}

/** float32 little-endian bytes, the layout stored in vec_aliases.embedding. */
export function float32Blob(vec: ArrayLike<number>): Uint8Array {
  const f = Float32Array.from(vec as ArrayLike<number>);
  const out = new Uint8Array(f.length * 4);
  const view = new DataView(out.buffer);
  f.forEach((x, i) => view.setFloat32(i * 4, x, true));
  return out;
}
