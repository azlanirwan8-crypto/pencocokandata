// Satu lapis penghubung Postgres untuk semua fungsi `api/*`.
//
// Dulu setiap endpoint memakai `neon(DATABASE_URL)` (driver HTTP khusus Neon).
// Sekarang proyek pindah ke Supabase Postgres, yang berbicara lewat protokol TCP
// biasa — jadi driver-nya `pg`. Bentuk hasilnya dibuat SERAGAM dengan pemakaian lama:
//   sql`SELECT ...`            -> array baris
//   sql.query(text, params)    -> array baris (plus `.rows` untuk kode lama)
// supaya 125 titik pemanggilan di api/ tidak perlu ditulis ulang.
//
// Catatan koneksi: pakai "Connection pooling" mode TRANSACTION (port 6543) dari
// konsol Supabase. `pg` mengirim pernyataan tanpa nama, jadi kompatibel dengan
// pooler; port 5432 (direct) menuntut IP Vercel diizinkan di Supabase.
import { Pool } from 'pg';

let pool: Pool | null = null;
let poolUrl = '';

function getPool(url: string): Pool {
  // Container serverless bisa dipakai ulang: kalau URL berubah (rotasi env),
  // kolam lama dibuang agar tidak ada koneksi menggantung ke basis data lama.
  if (pool && poolUrl === url) return pool;
  if (pool) void pool.end();
  pool = new Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
  poolUrl = url;
  return pool;
}

export interface JalanSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]>;
  (text: string, values?: unknown[]): Promise<any[]>;
  query(text: string, values?: unknown[]): Promise<any[]>;
}

/** Pembuat klien SQL dari `DATABASE_URL` (Supabase Postgres). */
export function buatSql(url: string): JalanSql {
  const jalan = async (text: string, params: unknown[] = []): Promise<any[]> => {
    const res = await getPool(url).query(text, params as any[]);
    const rows = res.rows as any[];
    // Kompatibel dengan pemakai lama yang menulis `.rows`.
    try {
      (rows as any).rows = rows;
    } catch {
      /* array beku (jarang) — biarkan tanpa properti tambahan */
    }
    return rows;
  };

  const sql = ((strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings !== 'string') {
      // Template literal -> parameter $1..$n (bukan string yang digabung manual,
      // supaya tidak ada celah injeksi SQL).
      let text = strings[0];
      for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1] ?? ''}`;
      return jalan(text, values);
    }
    return jalan(strings, (values[0] as unknown[]) ?? []);
  }) as JalanSql;

  sql.query = (text: string, values?: unknown[]) => jalan(text, (values as unknown[]) ?? []);
  return sql;
}

/** Nama env yang dibaca semua endpoint, urut prioritas. */
export const NAMA_ENV_DB = ['DATABASE_URL', 'SUPABASE_DB_URL', 'NEON_DATABASE_URL'] as const;

export function ambilUrlDb(env: NodeJS.ProcessEnv = process.env): string {
  for (const nama of NAMA_ENV_DB) {
    const v = env[nama];
    if (v && v.trim()) return v.trim();
  }
  return '';
}
