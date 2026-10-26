import { createApp } from './app.ts';
import { DB_PATH, openDb } from './db.ts';

const db = openDb(DB_PATH);
const app = createApp({ db, now: Date.now });
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}/api`);
});
