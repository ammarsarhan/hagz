import { createRouter } from "@/platform/http/router";
import { listCustomerAccounts, listStaffAccounts } from "../application/admin-support";
import * as route from "./definitions/support";

export const supportAdminRoutes = createRouter()
  .openapi(route.listStaff, async (c) => {
    return c.json(await listStaffAccounts(c.req.valid("query")), 200);
  })
  .openapi(route.listCustomers, async (c) => {
    return c.json(await listCustomerAccounts(c.req.valid("query")), 200);
  });
