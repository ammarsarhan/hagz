import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/platform/config/env";

// Authenticator-app codes (RFC 6238, the parameters every app supports: SHA-1, 30-second steps,
// 6 digits). Admins must use one.

const STEP_SECONDS = 30;
const DIGITS = 6;
// One step either side, for clocks a little off and codes typed as they roll over.
const DRIFT_STEPS = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const base32Encode = (bytes: Buffer): string => {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32.charAt((value << (5 - bits)) & 31);
  return out;
};

export const base32Decode = (text: string): Buffer => {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

// 160 bits, the size RFC 4226 recommends for SHA-1. Base32, as authenticator apps expect.
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

export const totpStep = (at: Date): number => Math.floor(at.getTime() / 1000 / STEP_SECONDS);

// HOTP (RFC 4226) for one time step.
export const totpCode = (secret: string, step: number): string => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0xf;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
};

// The step `code` belongs to, if it's valid now and newer than `lastStep`: a code works once, so one
// seen over a shoulder or in a phishing proxy can't be replayed.
export const matchTotp = (
  secret: string,
  code: string,
  at: Date,
  lastStep: number | null,
): number | undefined => {
  if (!/^\d{6}$/.test(code)) return undefined;
  const typed = Buffer.from(code);
  const now = totpStep(at);
  for (let step = now - DRIFT_STEPS; step <= now + DRIFT_STEPS; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    if (timingSafeEqual(Buffer.from(totpCode(secret, step)), typed)) return step;
  }
  return undefined;
};

// What authenticator apps scan as a QR code.
export const otpauthUri = ({ secret, account }: { secret: string; account: string }) => {
  const issuer = "Hagz";
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?${params.toString()}`;
};

// Unlike passwords and codes, the secret must be readable to check a code, so it's encrypted
// (AES-256-GCM) rather than hashed: a database leak alone doesn't give away anyone's second factor.
// "v1." leaves room to rotate the key.
export const encryptTotpSecret = (secret: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", env.TOTP_ENCRYPTION_KEY, iv);
  const sealed = Buffer.concat([
    iv,
    cipher.update(secret, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return `v1.${sealed.toString("base64url")}`;
};

export const decryptTotpSecret = (stored: string): string => {
  if (!stored.startsWith("v1.")) throw new Error("Unknown TOTP secret format");
  const sealed = Buffer.from(stored.slice(3), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", env.TOTP_ENCRYPTION_KEY, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  return Buffer.concat([
    decipher.update(sealed.subarray(12, sealed.length - 16)),
    decipher.final(),
  ]).toString("utf8");
};
