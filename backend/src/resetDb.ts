import { rmSync } from 'node:fs';
import { DB_PATH, openDb } from './db.ts';

for (const suffix of ['', '-wal', '-shm']) rmSync(DB_PATH + suffix, { force: true });

const db = openDb(DB_PATH);
const { count } = db.prepare('SELECT COUNT(*) AS count FROM courts').get() as { count: number };
db.close();
console.log(`Base de datos reiniciada en ${DB_PATH} (${count} canchas).`);
