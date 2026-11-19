import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminAccountQuery,
  AdminCustomerAccount,
  AdminStaffAccount,
  page,
  SuspendAccount,
} from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Support page: the staff and customer accounts, to find someone to help and
// look after their access. Staff suspensions and bans are with the venues' admin routes.

const tags = ["Support (admin)"];
const security = [{ [ADMIN_COOKIE_AUTH]: [] }];
const guarded = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED: refresh, or sign in."),
  403: problemResponse(
    `ACCOUNT_SUSPENDED, or ADMIN_HEADER_REQUIRED: send \`${ADMIN_CSRF_HEADER}: 1\`.`,
  ),
};

export const listStaff = createRoute({
  method: "get",
  path: "/admin/staff",
  tags,
  summary: "Staff accounts",
  description:
    "Newest first, a page at a time, with the venues each is on. Deleted ones are left out.",
  middleware: [requireAdmin] as const,
  security,
  request: { query: AdminAccountQuery },
  responses: {
    200: { description: "A page of staff", ...json(page(AdminStaffAccount)) },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
  },
});

export const listCustomers = createRoute({
  method: "get",
  path: "/admin/customers",
  tags,
  summary: "Customer accounts",
  description: "Newest first, a page at a time. Deleted ones are left out.",
  middleware: [requireAdmin] as const,
  security,
  request: { query: AdminAccountQuery },
  responses: {
    200: { description: "A page of customers", ...json(page(AdminCustomerAccount)) },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
  },
});

const customerParams = z.object({ customerId: z.uuid() });

export const suspendCustomer = createRoute({
  method: "post",
  path: "/admin/customers/{customerId}/suspend",
  tags,
  summary: "Suspend a customer account",
  description:
    "Signs them out everywhere and keeps them out until reactivated; an access token they hold " +
    "works until it expires, within 10 minutes. Recorded on the account. Suspending again changes " +
    "nothing.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: customerParams, body: { required: true, ...json(SuspendAccount) } },
  responses: {
    204: { description: "Suspended" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("CUSTOMER_NOT_FOUND"),
    409: problemResponse("ACCOUNT_BANNED: closed for good"),
  },
});

export const reactivateCustomer = createRoute({
  method: "post",
  path: "/admin/customers/{customerId}/reactivate",
  tags,
  summary: "Reactivate a suspended customer account",
  description:
    "They can sign in again. Recorded on the account. Reactivating an active account changes nothing.",
  middleware: [requireAdmin] as const,
  security,
  request: { params: customerParams },
  responses: {
    204: { description: "Reactivated" },
    ...guarded,
    400: problemResponse("VALIDATION_FAILED"),
    404: problemResponse("CUSTOMER_NOT_FOUND"),
    409: problemResponse("ACCOUNT_BANNED: closed for good"),
  },
});
