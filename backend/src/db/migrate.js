import { query } from './pool.js';
import dotenv from 'dotenv';
dotenv.config();

const migrate = async () => {
  console.log('Running migrations...');

  await query(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`);

  await query(`
    CREATE TABLE IF NOT EXISTS dumps (
      id            TEXT PRIMARY KEY,
      company       TEXT NOT NULL,
      upload_date   DATE NOT NULL,
      remarks       TEXT DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
   

  await query(`
    CREATE TABLE IF NOT EXISTS policies (
      id                  TEXT PRIMARY KEY,
      policy_no           TEXT NOT NULL,
      dump_id             TEXT NOT NULL REFERENCES dumps(id) ON DELETE CASCADE,
      recv_date           DATE,
      rm_name             TEXT DEFAULT '',
      imd_name            TEXT DEFAULT '',
      given_date          DATE,
      rm_response         TEXT DEFAULT '',
      rm_resolved         BOOLEAN DEFAULT FALSE,
      company_resolved    BOOLEAN DEFAULT FALSE,
      remarks             TEXT DEFAULT '',
      pending_side        TEXT DEFAULT '',
      extra               JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`ALTER TABLE policies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`);

  // Indexes for common filter queries
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_dump_id    ON policies(dump_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_rm_name    ON policies(rm_name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_resolved   ON policies(rm_resolved, company_resolved);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_recv_date  ON policies(recv_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_deleted_at ON policies(deleted_at);`);

  // Auto-update updated_at trigger
  await query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `);
  await query(`
    DROP TRIGGER IF EXISTS dumps_updated_at ON dumps;
    CREATE TRIGGER dumps_updated_at
      BEFORE UPDATE ON dumps
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  await query(`
    DROP TRIGGER IF EXISTS policies_updated_at ON policies;
    CREATE TRIGGER policies_updated_at
      BEFORE UPDATE ON policies
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  console.log('✅ Migrations complete');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
