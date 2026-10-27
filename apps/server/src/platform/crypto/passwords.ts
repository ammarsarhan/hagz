import { hash, parseOptions, verify } from "@node-rs/argon2";

// argon2id (the library's default algorithm) at OWASP's recommended minimum: 19 MiB, 2 passes,
// 1 thread. Raising these later is safe: needsRehash() flags old hashes, and login re-hashes them.
const policy = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string): Promise<string> => hash(password, policy);

// Hashed once, lazily. Verifying against it when an account doesn't exist makes a failed login take
// as long as a wrong password, so response times don't reveal which phone numbers are registered.
let dummy: Promise<string> | undefined;

export const verifyPassword = async (
  storedHash: string | undefined,
  password: string,
): Promise<boolean> => {
  if (storedHash === undefined) {
    dummy ??= hashPassword("dummy password for timing");
    await verify(await dummy, password);
    return false;
  }
  return verify(storedHash, password);
};

export const needsRehash = (storedHash: string): boolean => {
  if (!storedHash.startsWith("$argon2id$")) return true;
  const { memoryCost, timeCost, parallelism } = parseOptions(storedHash);
  return (
    memoryCost !== policy.memoryCost ||
    timeCost !== policy.timeCost ||
    parallelism !== policy.parallelism
  );
};
