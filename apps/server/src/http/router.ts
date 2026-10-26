import { Hono } from "hono";
import { health } from "@/http/health";

// Composition root: global middleware and every module's routes are mounted here.
export const router = new Hono().route("/health", health);
