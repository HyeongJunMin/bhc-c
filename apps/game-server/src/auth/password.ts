import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

const HASH_VERSION = 'v1';
const ARGON2_MEMORY_KIB = 64 * 1024;
const ARGON2_PASSES = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;

function toBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64');
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

async function createDigest(password: string, nonce: Uint8Array): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: password,
        nonce,
        memory: ARGON2_MEMORY_KIB,
        passes: ARGON2_PASSES,
        parallelism: ARGON2_PARALLELISM,
        tagLength: ARGON2_TAG_LENGTH,
      },
      (error, digest) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(digest);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const hashBuffer = await createDigest(password, nonce);

  return [HASH_VERSION, 'argon2id', toBase64(nonce), toBase64(hashBuffer)].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split('$');
  if (parts.length !== 4) {
    return false;
  }

  const [version, algorithm, nonceEncoded, digestEncoded] = parts;
  if (version !== HASH_VERSION || algorithm !== 'argon2id') {
    return false;
  }

  const nonce = fromBase64(nonceEncoded);
  const expectedDigest = fromBase64(digestEncoded);
  if (nonce.length === 0 || expectedDigest.length === 0) {
    return false;
  }

  const actualDigest = await createDigest(password, nonce);
  if (actualDigest.length !== expectedDigest.length) {
    return false;
  }

  return timingSafeEqual(actualDigest, expectedDigest);
}
