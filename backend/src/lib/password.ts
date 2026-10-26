import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

const derive = (plain: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(plain, salt, KEY_LEN, SCRYPT_OPTS, (err, key) => (err ? reject(err) : resolve(key))),
  );

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(16);
  const hash = await derive(plain, salt);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
};

export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await derive(plain, Buffer.from(saltB64, 'base64'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

// Hash ficticio para igualar tiempos cuando el correo no existe (FR-003).
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

export const verifyAgainstDummy = async (plain: string): Promise<false> => {
  await verifyPassword(plain, DUMMY_HASH);
  return false;
};
