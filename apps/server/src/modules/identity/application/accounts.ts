import { Prisma } from "@/generated/prisma/client";
import type { AccountStatus, Language, VerificationPurpose } from "@/generated/prisma/enums";
import { ownsAVenue, restrictAfterPasswordReset } from "@/modules/venues";
import type { Clock } from "@/platform/clock/clock";
import { prisma } from "@/platform/db/prisma";
import type { Tx } from "@/platform/db/transaction";
import type { AccountType } from "../domain/policy";

// Customers and staff sign in the same way but live in parallel tables (Customer/Staff,
// CustomerSession/StaffSession, CustomerVerification/StaffVerification). Each store maps the shared
// flows onto one set of tables, so sign-up, sign-in, refresh, reset and two-factor are written once.

export interface Account {
  id: string;
  name: string;
  phone: string | null;
  passwordHash: string;
  language: Language;
  twoFactorEnabled: boolean;
  status: AccountStatus;
}

// What sign-up and sign-in return about the account.
export const profile = (account: Account) => ({
  id: account.id,
  name: account.name,
  phone: account.phone ?? "",
  language: account.language,
});

type Db = Tx | typeof prisma;

interface AccountChanges {
  passwordHash?: string;
  twoFactorEnabled?: boolean;
  lastLoginAt?: Date;
}

export interface NewSession {
  refreshTokenHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}

export interface LockedSession {
  id: string;
  accountId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  status: AccountStatus;
}

export interface OpenCode {
  id: string;
  codeHash: string;
  attempts: number;
}

export interface CodeQuery {
  accountId: string;
  purpose: VerificationPurpose;
}

export interface AccountStore {
  type: AccountType;
  // The unique index a second sign-up with the same phone violates.
  phoneIndex: string;
  findByPhone(phone: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  update(db: Db, id: string, changes: AccountChanges): Promise<unknown>;
  // Whether the account may reset its own password with a code to its phone.
  selfServiceReset(account: Account): Promise<boolean>;
  // Runs in the reset's transaction, after the new password and the sign-out of every session.
  afterPasswordReset(tx: Tx, account: Account, clock: Clock): Promise<void>;
  sessions: {
    create(tx: Tx, accountId: string, session: NewSession): Promise<{ id: string }>;
    // FOR UPDATE, with the account's status, so concurrent refreshes of one session run in turn.
    lock(tx: Tx, sessionId: string): Promise<LockedSession | undefined>;
    rotate(
      tx: Tx,
      sessionId: string,
      changes: { refreshTokenHash: string; expiresAt: Date; lastUsedAt: Date },
    ): Promise<unknown>;
    // One session when `sessionId` is given, otherwise all of them. Scoped to the account.
    revoke(db: Db, accountId: string, at: Date, sessionId?: string): Promise<unknown>;
  };
  codes: {
    latestCreatedAt(tx: Tx, query: CodeQuery): Promise<Date | undefined>;
    consumeOpen(tx: Tx, query: CodeQuery, at: Date): Promise<unknown>;
    create(
      tx: Tx,
      query: CodeQuery & { codeHash: string; expiresAt: Date },
    ): Promise<{ id: string }>;
    delete(id: string): Promise<unknown>;
    // The newest open code (or the given one), FOR UPDATE, so guesses can't race past the limit.
    lockOpen(
      tx: Tx,
      query: CodeQuery & { now: Date; verificationId?: string },
    ): Promise<OpenCode | undefined>;
    update(tx: Tx, id: string, changes: { attempts?: number; consumedAt?: Date }): Promise<unknown>;
  };
}

const onlyId = (verificationId: string | undefined) =>
  verificationId ? Prisma.sql`AND id = ${verificationId}::uuid` : Prisma.empty;

export const customers: AccountStore = {
  type: "customer",
  phoneIndex: "Customer_phone_key",
  findByPhone: (phone) => prisma.customer.findUnique({ where: { phone } }),
  findById: (id) => prisma.customer.findUnique({ where: { id } }),
  update: (db, id, data) => db.customer.update({ where: { id }, data }),
  // A recycled number can take over a customer account; accepted, and support resolves it.
  selfServiceReset: () => Promise.resolve(true),
  afterPasswordReset: () => Promise.resolve(),
  sessions: {
    create: (tx, customerId, data) => tx.customerSession.create({ data: { customerId, ...data } }),
    lock: async (tx, sessionId) => {
      const [session] = await tx.$queryRaw<LockedSession[]>`
        SELECT s.id, s."customerId" AS "accountId", s."refreshTokenHash", s."expiresAt",
          s."revokedAt", a.status
        FROM "CustomerSession" s JOIN "Customer" a ON a.id = s."customerId"
        WHERE s.id = ${sessionId}::uuid
        FOR UPDATE OF s`;
      return session;
    },
    rotate: (tx, id, data) => tx.customerSession.update({ where: { id }, data }),
    revoke: (db, customerId, at, id) =>
      db.customerSession.updateMany({
        where: { customerId, revokedAt: null, ...(id && { id }) },
        data: { revokedAt: at, pushToken: null },
      }),
  },
  codes: {
    latestCreatedAt: async (tx, { accountId, purpose }) =>
      (
        await tx.customerVerification.findFirst({
          where: { customerId: accountId, purpose },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      )?.createdAt,
    consumeOpen: (tx, { accountId, purpose }, at) =>
      tx.customerVerification.updateMany({
        where: { customerId: accountId, purpose, consumedAt: null },
        data: { consumedAt: at },
      }),
    create: (tx, { accountId, ...data }) =>
      tx.customerVerification.create({ data: { customerId: accountId, ...data } }),
    delete: (id) => prisma.customerVerification.delete({ where: { id } }),
    lockOpen: async (tx, { accountId, purpose, now, verificationId }) => {
      const [open] = await tx.$queryRaw<OpenCode[]>`
        SELECT id, "codeHash", attempts FROM "CustomerVerification"
        WHERE "customerId" = ${accountId}::uuid AND purpose = ${purpose}::"VerificationPurpose"
          AND "consumedAt" IS NULL AND "expiresAt" > ${now} ${onlyId(verificationId)}
        ORDER BY "createdAt" DESC LIMIT 1
        FOR UPDATE`;
      return open;
    },
    update: (tx, id, data) => tx.customerVerification.update({ where: { id }, data }),
  },
};

export const staff: AccountStore = {
  type: "staff",
  phoneIndex: "Staff_phone_key",
  findByPhone: (phone) => prisma.staff.findUnique({ where: { phone } }),
  findById: (id) => prisma.staff.findUnique({ where: { id } }),
  update: (db, id, data) => db.staff.update({ where: { id }, data }),
  // A recycled number must not hand over a venue: owners reset through support.
  selfServiceReset: async (account) => !(await ownsAVenue(account.id)),
  afterPasswordReset: (tx, account, clock) => restrictAfterPasswordReset(tx, account.id, clock),
  sessions: {
    create: (tx, staffId, data) => tx.staffSession.create({ data: { staffId, ...data } }),
    lock: async (tx, sessionId) => {
      const [session] = await tx.$queryRaw<LockedSession[]>`
        SELECT s.id, s."staffId" AS "accountId", s."refreshTokenHash", s."expiresAt",
          s."revokedAt", a.status
        FROM "StaffSession" s JOIN "Staff" a ON a.id = s."staffId"
        WHERE s.id = ${sessionId}::uuid
        FOR UPDATE OF s`;
      return session;
    },
    rotate: (tx, id, data) => tx.staffSession.update({ where: { id }, data }),
    revoke: (db, staffId, at, id) =>
      db.staffSession.updateMany({
        where: { staffId, revokedAt: null, ...(id && { id }) },
        data: { revokedAt: at, pushToken: null },
      }),
  },
  codes: {
    latestCreatedAt: async (tx, { accountId, purpose }) =>
      (
        await tx.staffVerification.findFirst({
          where: { staffId: accountId, purpose },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      )?.createdAt,
    consumeOpen: (tx, { accountId, purpose }, at) =>
      tx.staffVerification.updateMany({
        where: { staffId: accountId, purpose, consumedAt: null },
        data: { consumedAt: at },
      }),
    create: (tx, { accountId, ...data }) =>
      tx.staffVerification.create({ data: { staffId: accountId, ...data } }),
    delete: (id) => prisma.staffVerification.delete({ where: { id } }),
    lockOpen: async (tx, { accountId, purpose, now, verificationId }) => {
      const [open] = await tx.$queryRaw<OpenCode[]>`
        SELECT id, "codeHash", attempts FROM "StaffVerification"
        WHERE "staffId" = ${accountId}::uuid AND purpose = ${purpose}::"VerificationPurpose"
          AND "consumedAt" IS NULL AND "expiresAt" > ${now} ${onlyId(verificationId)}
        ORDER BY "createdAt" DESC LIMIT 1
        FOR UPDATE`;
      return open;
    },
    update: (tx, id, data) => tx.staffVerification.update({ where: { id }, data }),
  },
};
