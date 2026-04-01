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
    role TEXT DEFAULT 'user',
    permissions JSONB DEFAULT '{}'::jsonb,
    assigned_rm TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`);
  await query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';`);
  await query(`UPDATE users SET role = 'user' WHERE role = 'viewer';`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_rm TEXT DEFAULT '';`);

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

  await query(`
    CREATE TABLE IF NOT EXISTS renewal_dumps (
      id            TEXT PRIMARY KEY,
      company       TEXT NOT NULL,
      upload_date   DATE NOT NULL,
      remarks       TEXT DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS renewals (
      id                    TEXT PRIMARY KEY,
      renewal_dump_id       TEXT NOT NULL REFERENCES renewal_dumps(id) ON DELETE CASCADE,
      dedupe_key            TEXT NOT NULL,
      sheet_name            TEXT DEFAULT '',
      policy_number         TEXT DEFAULT '',
      original_policy_number TEXT DEFAULT '',
      policy_holder_name    TEXT DEFAULT '',
      policy_holder_phone   TEXT DEFAULT '',
      policy_holder_email   TEXT DEFAULT '',
      insurer               TEXT DEFAULT '',
      broker_name           TEXT DEFAULT '',
      broker_code           TEXT DEFAULT '',
      rm_name               TEXT DEFAULT '',
      source_rm             TEXT DEFAULT '',
      latest_rm             TEXT DEFAULT '',
      source_partner        TEXT DEFAULT '',
      source_partner_code   TEXT DEFAULT '',
      source_partner_type   TEXT DEFAULT '',
      vehicle_number        TEXT DEFAULT '',
      vehicle_make          TEXT DEFAULT '',
      vehicle_model         TEXT DEFAULT '',
      vehicle_variant       TEXT DEFAULT '',
      year_of_manufacture   TEXT DEFAULT '',
      policy_type           TEXT DEFAULT '',
      vehicle_class         TEXT DEFAULT '',
      vehicle_subclass      TEXT DEFAULT '',
      subclass_name         TEXT DEFAULT '',
      vehicle_cc            TEXT DEFAULT '',
      vehicle_gvw           TEXT DEFAULT '',
      pivot_points          TEXT DEFAULT '',
      seating_capacity      TEXT DEFAULT '',
      fuel_type             TEXT DEFAULT '',
      rto_code              TEXT DEFAULT '',
      inwarding_date        DATE,
      policy_issue_date     DATE,
      policy_valid_from     DATE,
      policy_valid_till     DATE,
      od_end_date           DATE,
      tp_end_date           DATE,
      net_premium           TEXT DEFAULT '',
      total_premium_amount  TEXT DEFAULT '',
      status                TEXT DEFAULT 'Pending',
      customer_response     TEXT DEFAULT 'No Response',
      pending_with          TEXT DEFAULT '',
      next_follow_up_date   DATE,
      quoted_premium        TEXT DEFAULT '',
      renewed_premium       TEXT DEFAULT '',
      renewed_insurer       TEXT DEFAULT '',
      renewed_on            DATE,
      remarks               TEXT DEFAULT '',
      raw_data              JSONB DEFAULT '{}'::jsonb,
      deleted_at            TIMESTAMPTZ,
      created_at            TIMESTAMPTZ DEFAULT NOW(),
      updated_at            TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Indexes for common filter queries
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_dump_id    ON policies(dump_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_rm_name    ON policies(rm_name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_resolved   ON policies(rm_resolved, company_resolved);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_recv_date  ON policies(recv_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_policies_deleted_at ON policies(deleted_at);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_renewals_dump_id    ON renewals(renewal_dump_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_renewals_rm_name    ON renewals(rm_name);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_renewals_status     ON renewals(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_renewals_valid_till ON renewals(policy_valid_till);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_renewals_deleted_at ON renewals(deleted_at);`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_renewals_unique_active
    ON renewals(renewal_dump_id, dedupe_key)
    WHERE deleted_at IS NULL;
  `);

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
  await query(`
    DROP TRIGGER IF EXISTS renewal_dumps_updated_at ON renewal_dumps;
    CREATE TRIGGER renewal_dumps_updated_at
      BEFORE UPDATE ON renewal_dumps
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
  await query(`
    DROP TRIGGER IF EXISTS renewals_updated_at ON renewals;
    CREATE TRIGGER renewals_updated_at
      BEFORE UPDATE ON renewals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  console.log('✅ Migrations complete');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
