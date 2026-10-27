import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  matchTotp,
  otpauthUri,
  totpCode,
  totpStep,
} from "@/platform/crypto/totp";

// RFC 6238 appendix B (SHA-1), last six digits of each.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const at = (seconds: number) => new Date(seconds * 1000);

describe("TOTP", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])("matches the RFC test vector at %i s", (seconds, code) => {
    expect(totpCode(RFC_SECRET, totpStep(at(seconds)))).toBe(code);
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 255, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("accepts one step of clock drift either way, and no more", () => {
    const secret = generateTotpSecret();
    const now = at(1_800_000_000);
    const step = totpStep(now);
    for (const offset of [-1, 0, 1]) {
      expect(matchTotp(secret, totpCode(secret, step + offset), now, null)).toBe(step + offset);
    }
    expect(matchTotp(secret, totpCode(secret, step - 2), now, null)).toBeUndefined();
    expect(matchTotp(secret, totpCode(secret, step + 2), now, null)).toBeUndefined();
  });

  it("never accepts a code from a step already used", () => {
    const secret = generateTotpSecret();
    const now = at(1_800_000_000);
    const step = totpStep(now);
    const code = totpCode(secret, step);
    expect(matchTotp(secret, code, now, step)).toBeUndefined();
    expect(matchTotp(secret, totpCode(secret, step - 1), now, step - 1)).toBeUndefined();
    expect(matchTotp(secret, totpCode(secret, step + 1), now, step)).toBe(step + 1);
  });

  it("rejects anything that isn't six digits", () => {
    const secret = generateTotpSecret();
    const now = at(1_800_000_000);
    const code = totpCode(secret, totpStep(now));
    for (const typed of ["", code.slice(0, 5), `${code}0`, `${code.slice(0, 5)}x`, " ".repeat(6)]) {
      expect(matchTotp(secret, typed, now, null)).toBeUndefined();
    }
  });

  it("encrypts secrets at rest, and detects tampering", () => {
    const secret = generateTotpSecret();
    const stored = encryptTotpSecret(secret);
    expect(stored).not.toContain(secret);
    expect(stored).not.toBe(encryptTotpSecret(secret));
    expect(decryptTotpSecret(stored)).toBe(secret);

    const tampered = `${stored.slice(0, -2)}${stored.endsWith("A") ? "B" : "A"}A`;
    expect(() => decryptTotpSecret(tampered)).toThrow();
  });

  it("builds the URI authenticator apps scan", () => {
    const uri = new URL(otpauthUri({ secret: "JBSWY3DPEHPK3PXP", account: "omar@hagz.app" }));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Hagz:omar@hagz.app");
    expect(Object.fromEntries(uri.searchParams)).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      issuer: "Hagz",
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
  });
});
