import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { UnsecuredJWT } from "jose";
import { afterEach, describe, expect, it } from "vitest";
import type { Clock } from "@/platform/clock/clock";
import { env } from "@/platform/config/env";
import { codeMatches, generateCode, hashCode } from "@/platform/crypto/codes";
import { signJwt, verifyJwt } from "@/platform/crypto/jwt";
import { hashPassword, needsRehash, verifyPassword } from "@/platform/crypto/passwords";
import { hashToken, randomToken } from "@/platform/crypto/tokens";

const at = (iso: string): Clock => ({ now: () => new Date(iso) });

describe("passwords", () => {
  it("hashes with argon2id and verifies only the right password", async () => {
    const stored = await hashPassword("correct horse");

    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword(stored, "correct horse")).toBe(true);
    expect(await verifyPassword(stored, "wrong horse")).toBe(false);
  });

  it("rejects a login for an account that doesn't exist, after doing the same work", async () => {
    expect(await verifyPassword(undefined, "anything")).toBe(false);
  });

  it("flags hashes made under an older policy for re-hashing", async () => {
    expect(needsRehash(await hashPassword("pw"))).toBe(false);
    expect(needsRehash(await hash("pw", { memoryCost: 4096, timeCost: 2, parallelism: 1 }))).toBe(
      true,
    );
    expect(needsRehash("$2b$10$somebcrypthash")).toBe(true);
  });
});

describe("one-time codes", () => {
  it("generates six digits, leading zeros included", () => {
    const codes = Array.from({ length: 200 }, generateCode);
    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
  });

  it("stores only a keyed hash and matches in constant time", () => {
    const stored = hashCode("012345");

    expect(stored).not.toContain("012345");
    expect(codeMatches("012345", stored)).toBe(true);
    expect(codeMatches("012346", stored)).toBe(false);
    expect(codeMatches("012345", "not-a-hash")).toBe(false);
  });
});

describe("opaque tokens", () => {
  it("are 256-bit, unique, and stored as a stable hash", () => {
    const token = randomToken();

    expect(token).toHaveLength(43);
    expect(randomToken()).not.toBe(token);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

describe("JWT", () => {
  const claims = { sub: "customer-1", sid: "session-1" };
  const keys = [...env.JWT_SIGNING_KEYS];
  afterEach(() => {
    env.JWT_SIGNING_KEYS.splice(0, Infinity, ...keys);
  });

  it("round-trips the subject and session", async () => {
    const token = await signJwt(claims, { audience: "customer", ttlSeconds: 600 });

    expect(await verifyJwt(token, "customer")).toMatchObject(claims);
  });

  it("rejects a token meant for another account type", async () => {
    const token = await signJwt(claims, { audience: "customer", ttlSeconds: 600 });

    await expect(verifyJwt(token, "staff")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("tells an expired token apart from an invalid one", async () => {
    const token = await signJwt(
      claims,
      { audience: "customer", ttlSeconds: 600 },
      at("2026-01-01T10:00:00Z"),
    );

    await expect(verifyJwt(token, "customer", at("2026-01-01T10:09:59Z"))).resolves.toMatchObject(
      claims,
    );
    await expect(verifyJwt(token, "customer", at("2026-01-01T10:10:01Z"))).rejects.toMatchObject({
      status: 401,
      code: "TOKEN_EXPIRED",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await signJwt(claims, { audience: "customer", ttlSeconds: 600 });
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...claims, sub: "someone-else" })).toString(
      "base64url",
    );

    await expect(
      verifyJwt(`${header}.${forgedPayload}.${signature}`, "customer"),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const token = new UnsecuredJWT({ sid: claims.sid })
      .setSubject(claims.sub)
      .setIssuer("hagz")
      .setAudience("customer")
      .setExpirationTime("10m")
      .encode();

    await expect(verifyJwt(token, "customer")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("keeps old tokens valid while their key is still listed, and not after", async () => {
    const oldToken = await signJwt(claims, { audience: "customer", ttlSeconds: 600 });
    // Rotate: a new key signs, the old one stays listed for verification.
    env.JWT_SIGNING_KEYS.unshift({ kid: "next", key: randomBytes(32) });

    const newToken = await signJwt(claims, { audience: "customer", ttlSeconds: 600 });
    expect(
      JSON.parse(Buffer.from(newToken.split(".")[0] ?? "", "base64url").toString()),
    ).toMatchObject({ kid: "next" });
    await expect(verifyJwt(oldToken, "customer")).resolves.toMatchObject(claims);

    // Retire the old key.
    env.JWT_SIGNING_KEYS.splice(1);
    await expect(verifyJwt(oldToken, "customer")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(verifyJwt(newToken, "customer")).resolves.toMatchObject(claims);
  });
});
