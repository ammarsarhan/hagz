import { createRoute } from "@hono/zod-openapi";
import { ReminderTokenBody, ReminderWeek } from "@hagz/contracts";
import { body, json, problemResponse } from "@/platform/http/definitions";
import { limitByIp } from "@/platform/rate-limit/rate-limit";

// The confirm link's page (docs/regulars.md "Reminders"): public, the token in the body (it rides
// in the link's fragment, so it never reaches a server's logs or a Referer header).

const tags = ["Confirm links"];
const week = { description: "The week, as it now is", ...json(ReminderWeek) };
const notFound = problemResponse("CONFIRM_LINK_NOT_FOUND");
const limited = problemResponse("RATE_LIMITED");
// Per IP: tokens are 256 bits, so this only keeps the endpoints from being hammered.
const byIp = limitByIp({
  name: "regulars:confirm-link:ip",
  limit: 60,
  windowMs: 10 * 60 * 1000,
  failOpen: true,
});

export const confirmLinkWeek = createRoute({
  method: "post",
  path: "/confirm-links/week",
  tags,
  summary: "The week a confirm link is for",
  description:
    "Read-only (a POST so the token stays out of the URL). `state` says whether it can still be answered.",
  middleware: [byIp] as const,
  security: [],
  request: { ...body(ReminderTokenBody) },
  responses: { 200: week, 404: notFound, 429: limited },
});

const answer = (action: "confirm" | "release", summary: string, description: string) =>
  createRoute({
    method: "post",
    path: `/confirm-links/${action}`,
    tags,
    summary,
    description,
    middleware: [byIp] as const,
    security: [],
    request: { ...body(ReminderTokenBody) },
    responses: { 200: week, 404: notFound, 429: limited },
  });

export const confirmLinkConfirm = answer(
  "confirm",
  "Confirm the week",
  "Uses the link up. A link that can't answer any more returns the week with its `state` instead.",
);

export const confirmLinkRelease = answer(
  "release",
  "Let the week go",
  "Uses the link up; the time goes back on sale, or to the next regular in line. A link that can't answer any more returns the week with its `state` instead.",
);
