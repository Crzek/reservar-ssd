import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type Db = Database.Database;

export const SCHEMA_PATH = fileURLToPath(new URL('../../db/schema.sql', import.meta.url));
export const DB_PATH = fileURLToPath(new URL('../../db/padel.db', import.meta.url));

export const openDb = (path: string): Db => {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (path !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
};
