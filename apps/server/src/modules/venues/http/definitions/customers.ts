import { createRoute, z } from "@hono/zod-openapi";
import {
  BookingSettings,
  UpdateBookingSettings,
  CreateVenueCustomer,
  UpdateVenueCustomer,
  VenueCustomer,
  VenueCustomerPage,
  VenueCustomersQuery,
} from "@hagz/contracts";
import { requireStaff, STAFF_BEARER } from "@/platform/http/authenticate";
import { body, json, problemResponse } from "@/platform/http/definitions";
import { requireVenueAccess } from "../require-venue-access";

// The venue's customers (PR 4.3). Reading needs `customers: view`; adding and editing need
// `customers: manage`.

const tags = ["Venue customers"];
const security = [{ [STAFF_BEARER]: [] }];
const venueParams = z.object({ venueId: z.uuid() });
const customerParams = venueParams.extend({ customerId: z.uuid() });
const common = {
  401: problemResponse("UNAUTHENTICATED or TOKEN_EXPIRED"),
  403: problemResponse("PERMISSION_DENIED (with `area` and `needed`), or ACCOUNT_SUSPENDED"),
};
const notFound = problemResponse(
  "VENUE_NOT_FOUND: not a venue you belong to. CUSTOMER_NOT_FOUND: no such customer here.",
);

// Routes declare their middleware inline: spread from a shared object, the route types lose `c.var`.

export const listCustomers = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/customers",
  tags,
  summary: "The venue's customers",
  description: "App players who booked here and walk-ins staff entered, A to Z, a page at a time.",
  middleware: [requireStaff, requireVenueAccess("customers", "view")] as const,
  security,
  request: { params: venueParams, query: VenueCustomersQuery },
  responses: {
    200: { description: "A page of customers", ...json(VenueCustomerPage) },
    400: problemResponse("INVALID_CURSOR"),
    ...common,
    404: notFound,
  },
});

export const getCustomer = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/customers/{customerId}",
  tags,
  summary: "One customer",
  middleware: [requireStaff, requireVenueAccess("customers", "view")] as const,
  security,
  request: { params: customerParams },
  responses: {
    200: { description: "The customer", ...json(VenueCustomer) },
    ...common,
    404: notFound,
  },
});

export const createCustomer = createRoute({
  method: "post",
  path: "/staff/venues/{venueId}/customers",
  tags,
  summary: "Add a walk-in customer",
  description: "Linked to the player's Hagz account by their number if they sign up later.",
  middleware: [requireStaff, requireVenueAccess("customers", "manage")] as const,
  security,
  request: { params: venueParams, ...body(CreateVenueCustomer) },
  responses: {
    201: { description: "The customer", ...json(VenueCustomer) },
    400: problemResponse("INVALID_PHONE_NUMBER"),
    ...common,
    404: notFound,
    409: problemResponse(
      "CUSTOMER_EXISTS: a customer here already has this number (with their `customerId` and `customerName`).",
    ),
  },
});

export const updateCustomer = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/customers/{customerId}",
  tags,
  summary: "Edit a customer",
  description:
    "The note for anyone; the name and number for walk-ins only (an app player's follow their account).",
  middleware: [requireStaff, requireVenueAccess("customers", "manage")] as const,
  security,
  request: { params: customerParams, ...body(UpdateVenueCustomer) },
  responses: {
    200: { description: "The customer", ...json(VenueCustomer) },
    400: problemResponse("INVALID_PHONE_NUMBER"),
    ...common,
    404: notFound,
    409: problemResponse(
      "CUSTOMER_LINKED: an app player's name and number can't be edited. CUSTOMER_EXISTS (with `customerId` and `customerName`).",
    ),
  },
});

const settingsTags = ["Venue settings"];

export const getBookingSettings = createRoute({
  method: "get",
  path: "/staff/venues/{venueId}/booking-settings",
  tags: settingsTags,
  summary: "Staff holds, regulars and Fill a slot settings",
  middleware: [requireStaff, requireVenueAccess("bookings", "view")] as const,
  security,
  request: { params: venueParams },
  responses: {
    200: { description: "The settings", ...json(BookingSettings) },
    ...common,
    404: problemResponse("VENUE_NOT_FOUND"),
    409: problemResponse("VENUE_STATUS_CONFLICT: no settings yet."),
  },
});

export const updateBookingSettings = createRoute({
  method: "patch",
  path: "/staff/venues/{venueId}/booking-settings",
  tags: settingsTags,
  summary: "Change staff holds, regulars and Fill a slot settings",
  description:
    "Needs `venue: manage`. Only what's sent changes. A new horizon or confirmation window applies to weeks reserved from now on.",
  middleware: [requireStaff, requireVenueAccess("venue", "manage")] as const,
  security,
  request: { params: venueParams, ...body(UpdateBookingSettings) },
  responses: {
    200: { description: "The settings", ...json(BookingSettings) },
    ...common,
    404: problemResponse("VENUE_NOT_FOUND"),
    409: problemResponse("VENUE_STATUS_CONFLICT"),
  },
});
