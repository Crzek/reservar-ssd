import type { ApiError, ErrorCode } from '../lib/types';

let unauthenticatedHandler: () => void = () => {};

export const onUnauthenticated = (handler: () => void): void => {
  unauthenticatedHandler = handler;
};

const readErrorCode = async (res: Response): Promise<ErrorCode> => {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === 'string' ? (body.error.code as ErrorCode) : 'INTERNAL';
  } catch {
    return 'INTERNAL';
  }
};

export const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw { code: 'NETWORK' } satisfies ApiError;
  }

  if (!res.ok) {
    if (res.status === 401) unauthenticatedHandler();
    throw { code: await readErrorCode(res) } satisfies ApiError;
  }
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw { code: 'INTERNAL' } satisfies ApiError;
  }
};

export const errorCodeOf = (err: unknown): string =>
  typeof err === 'object' && err !== null && typeof (err as ApiError).code === 'string'
    ? (err as ApiError).code
    : 'INTERNAL';
