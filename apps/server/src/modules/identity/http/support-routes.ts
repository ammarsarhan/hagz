import { createRouter } from "@/platform/http/router";
import {
  banStaff,
  grantStaffPasswordReset,
  reactivateCustomer,
  reactivateStaff,
  suspendCustomer,
  suspendStaff,
} from "../application/account-support";
import { listCustomerAccounts, listStaffAccounts } from "../application/admin-support";
import * as route from "./definitions/support";

export const supportAdminRoutes = createRouter()
  .openapi(route.listStaff, async (c) => {
    return c.json(await listStaffAccounts(c.req.valid("query")), 200);
  })
  .openapi(route.listCustomers, async (c) => {
    return c.json(await listCustomerAccounts(c.req.valid("query")), 200);
  })
  .openapi(route.suspendCustomer, async (c) => {
    const { customerId } = c.req.valid("param");
    await suspendCustomer(c.var.admin.adminId, customerId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.reactivateCustomer, async (c) => {
    await reactivateCustomer(c.var.admin.adminId, c.req.valid("param").customerId);
    return c.body(null, 204);
  })
  .openapi(route.suspendStaff, async (c) => {
    await suspendStaff(c.var.admin.adminId, c.req.valid("param").staffId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.banStaff, async (c) => {
    await banStaff(c.var.admin.adminId, c.req.valid("param").staffId, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(route.reactivateStaff, async (c) => {
    await reactivateStaff(c.var.admin.adminId, c.req.valid("param").staffId);
    return c.body(null, 204);
  })
  .openapi(route.grantStaffPasswordReset, async (c) => {
    const { staffId } = c.req.valid("param");
    await grantStaffPasswordReset(c.var.admin.adminId, staffId, c.req.valid("json"));
    return c.body(null, 204);
  });
