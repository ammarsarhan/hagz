import type { PermissionLevel } from "@/generated/prisma/enums.js";

export type PermissionDomain = "settings" | "bookings" | "analytics" | "payments" | "layout" | "team" | "properties";
export type Permissions = Record<PermissionDomain, PermissionLevel>;
