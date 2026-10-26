import { Hono } from "hono";
import { notFound, onError } from "@/http/errors";
import { health } from "@/http/health";

// Composition root: global middleware and every module's routes are mounted here.
export const router = new Hono().route("/health", health);

router.notFound(notFound);
router.onError(onError);
