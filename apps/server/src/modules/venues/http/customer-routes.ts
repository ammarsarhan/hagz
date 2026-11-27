import { createRouter } from "@/platform/http/router";
import {
  createVenueCustomer,
  listVenueCustomers,
  updateVenueCustomer,
  venueCustomerDetail,
} from "../application/customer-list";
import * as route from "./definitions/customers";

export const venuesCustomerRoutes = createRouter()
  .openapi(route.listCustomers, async (c) =>
    c.json(await listVenueCustomers(c.var.venue, c.req.valid("query")), 200),
  )
  .openapi(route.getCustomer, async (c) =>
    c.json(await venueCustomerDetail(c.var.venue, c.req.valid("param").customerId), 200),
  )
  .openapi(route.createCustomer, async (c) =>
    c.json(await createVenueCustomer(c.var.venue, c.req.valid("json")), 201),
  )
  .openapi(route.updateCustomer, async (c) =>
    c.json(
      await updateVenueCustomer(c.var.venue, c.req.valid("param").customerId, c.req.valid("json")),
      200,
    ),
  );
