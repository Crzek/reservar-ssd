import { parentPort, workerData } from 'node:worker_threads';
import { openDb } from '../src/db.ts';
import { createReservation } from '../src/routes/reservations.ts';
import { isHttpError } from '../src/lib/httpError.ts';

type Job = { round: number; userId: number; courtId: number; date: string; startHour: number; nowMs: number };

const { dbPath, signal } = workerData as { dbPath: string; signal: SharedArrayBuffer };
const gate = new Int32Array(signal);
const db = openDb(dbPath);

parentPort!.on('message', (job: Job) => {
  parentPort!.postMessage({ type: 'ready' });
  // Todos los hilos esperan en la misma barrera para arrancar a la vez.
  while (Atomics.load(gate, 0) < job.round) Atomics.wait(gate, 0, Atomics.load(gate, 0));
  try {
    createReservation(db, job, job.nowMs);
    parentPort!.postMessage({ type: 'result', code: 'CREATED' });
  } catch (err) {
    parentPort!.postMessage({ type: 'result', code: isHttpError(err) ? err.code : String(err) });
  }
});
