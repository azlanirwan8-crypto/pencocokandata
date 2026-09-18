/**
 * Util bersama untuk endpoint Neon.
 *
 * Setiap `CREATE TABLE / CREATE INDEX IF NOT EXISTS` adalah 1 round-trip HTTP ke
 * Postgres, jadi DDL dijalankan sekali per warm instance, bukan tiap request.
 */
const done = new Map<string, Promise<void>>();

export function oncePerInstance(key: string, run: () => Promise<void>): Promise<void> {
  let job = done.get(key);
  if (!job) {
    job = run().catch((err) => {
      done.delete(key);
      throw err;
    });
    done.set(key, job);
  }
  return job;
}

export function ensureAppStore(sql: any): Promise<void> {
  return oncePerInstance('app_store', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS app_store (
        key VARCHAR(100) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
  });
}
