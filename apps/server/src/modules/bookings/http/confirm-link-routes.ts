import { requestLanguage } from "@/platform/http/language";
import { createRouter } from "@/platform/http/router";
import { answerConfirmLink, confirmLinkWeek } from "../application/confirm-links";
import * as route from "./definitions/confirm-links";

export const bookingsConfirmLinkRoutes = createRouter()
  .openapi(route.confirmLinkWeek, async (c) =>
    c.json(await confirmLinkWeek(c.req.valid("json").token, requestLanguage(c)), 200),
  )
  .openapi(route.confirmLinkConfirm, async (c) =>
    c.json(await answerConfirmLink(c.req.valid("json").token, "CONFIRM", requestLanguage(c)), 200),
  )
  .openapi(route.confirmLinkRelease, async (c) =>
    c.json(await answerConfirmLink(c.req.valid("json").token, "RELEASE", requestLanguage(c)), 200),
  );
