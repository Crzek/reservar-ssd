import express from 'express';
import cookieParser from 'cookie-parser';
import type { Db } from './db.ts';
import { errorHandler, httpError } from './lib/httpError.ts';
import { authRouter } from './routes/auth.ts';
import { courtsRouter } from './routes/courts.ts';
import { reservationsRouter } from './routes/reservations.ts';

export type AppDeps = { db: Db; now: () => number };

export const createApp = ({ db, now }: AppDeps): express.Express => {
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.use('/api/auth', authRouter(db, now));
  app.use('/api/courts', courtsRouter(db, now));
  app.use('/api/reservations', reservationsRouter(db, now));
  app.use('/api', (_req, _res, next) => next(httpError(404, 'INVALID_INPUT')));
  app.use(errorHandler);
  return app;
};
