import { createRoute } from "@hono/zod-openapi";
import { AdminAccountQuery, AdminCustomerAccount, AdminStaffAccount, page } from "@hagz/contracts";
import { ADMIN_COOKIE_AUTH, ADMIN_CSRF_HEADER, requireAdmin } from "@/platform/http/authenticate";
import { json, problemResponse } from "@/platform/http/definitions";

// Admin routes for the Support page: the staff and customer accounts, to find someone to help.

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
