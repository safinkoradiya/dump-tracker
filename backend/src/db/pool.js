import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

console.log("DB URL:", process.env.DATABASE_URL);

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;