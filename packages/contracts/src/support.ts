import { z } from "zod";
import { AdminReason } from "./review";
import { VenueRole } from "./venues";

// The admin's Support page (plan 2.8): finding staff and customers to help them with their accounts.

export const AccountStatus = z
  .enum(["ACTIVE", "SUSPENDED", "BANNED"])
  .meta({ id: "AccountStatus", description: "`SUSPENDED` is temporary, `BANNED` for good." });

export const AdminAccountQuery = z.object({
  q: z.string().trim().max(100).optional().meta({
    description:
      "Part of the name, or of the phone number in any format (spaces, a leading 0 or the country code).",
  }),
  status: AccountStatus.optional(),
  cursor: z.uuid().optional().meta({ description: "`nextCursor` from the previous page." }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const account = {
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable().meta({ example: "+201001234567" }),
  status: AccountStatus,
  createdAt: z.iso.datetime(),
  lastSignedInAt: z.iso.datetime().nullable(),
};

export const AdminStaffAccount = z
  .object({
    ...account,
    venues: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string().nullable().meta({ description: "In English, else Arabic." }),
          role: VenueRole,
        }),
      )
      .meta({ description: "Every venue they're on, owned ones first." }),
  })
  .meta({ id: "AdminStaffAccount" });

export const AdminCustomerAccount = z.object(account).meta({ id: "AdminCustomerAccount" });

// Suspending a customer, staff or admin account.
export const SuspendAccount = z.object({ reason: AdminReason }).meta({ id: "SuspendAccount" });

// Letting a venue owner reset their password by phone, once support has checked who they are.
export const GrantPasswordReset = z
  .object({ reason: AdminReason })
  .meta({ id: "GrantPasswordReset" });

export type AccountStatus = z.infer<typeof AccountStatus>;
export type AdminAccountQuery = z.infer<typeof AdminAccountQuery>;
export type AdminStaffAccount = z.infer<typeof AdminStaffAccount>;
export type AdminCustomerAccount = z.infer<typeof AdminCustomerAccount>;
export type SuspendAccount = z.infer<typeof SuspendAccount>;
export type GrantPasswordReset = z.infer<typeof GrantPasswordReset>;
