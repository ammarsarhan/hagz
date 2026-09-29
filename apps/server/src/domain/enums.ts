import type { BookingStatus, Role } from "@hagz/contracts";
import type { BookingStatus as DbBookingStatus, Role as DbRole } from "@/generated/prisma/enums";

// Fails to compile if the Prisma enums and the contracts drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const assert = <T extends true>() => undefined as unknown as T;

assert<Same<BookingStatus, DbBookingStatus>>();
assert<Same<Role, DbRole>>();
