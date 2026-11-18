import { AdminCustomerAccount, AdminStaffAccount, page } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { totpCode, totpStep } from "@/platform/crypto/totp";
import { prisma } from "@/platform/db/prisma";
import { resetDatabase } from "../../support/database";
import {
  addMember,
  createAdmin,
  createCustomer,
  createMarketplace,
  createStaff,
  createVenue,
} from "../../support/factories";
import { resetRedis } from "../../support/redis";

let cookie = "";

const signIn = async () => {
  const { secret } = await createAdmin();
  const start = await router.request("/v1/auth/admin/sessions", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ email: "omar@hagz.app", password: "correct horse battery" }),
  });
  const { challengeToken } = (await start.json()) as { challengeToken: string };
  const done = await router.request("/v1/auth/admin/sessions/totp", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Hagz-Admin": "1" },
    body: JSON.stringify({ challengeToken, code: totpCode(secret, totpStep(new Date())) }),
  });
  cookie = done.headers
    .getSetCookie()
    .map((c) => c.split("; ")[0])
    .join("; ");
};

const get = (path: string) =>
  router.request(`/v1/admin${path}`, { headers: { "X-Hagz-Admin": "1", Cookie: cookie } });

const staffPage = async (query = "") =>
  page(AdminStaffAccount).parse(await (await get(`/staff${query}`)).json());
const customerPage = async (query = "") =>
  page(AdminCustomerAccount).parse(await (await get(`/customers${query}`)).json());

beforeEach(async () => {
  await resetDatabase();
  await resetRedis();
  await signIn();
});

describe("finding staff", () => {
  it("lists them newest first, a page at a time, with the venues they're on", async () => {
    const first = await createStaff({ phone: "+201001110000" });
    const second = await createStaff({ phone: "+201002220000" });
    const marketplace = await createMarketplace();
    const venue = await createVenue(marketplace.id);
    await prisma.venueTranslation.create({
      data: { venueId: venue.id, language: "EN", name: "Champions Arena" },
    });
    await addMember(venue.id, first.id, { role: "OWNER" });

    const one = await staffPage("?limit=1");
    expect(one.data.map((s) => s.id)).toEqual([second.id]);
    expect(one.nextCursor).toBe(second.id);
    const rest = await staffPage(`?limit=1&cursor=${one.nextCursor}`);
    expect(rest.data[0]).toMatchObject({
      id: first.id,
      status: "ACTIVE",
      venues: [{ id: venue.id, name: "Champions Arena", role: "OWNER" }],
    });
    expect(rest.nextCursor).toBeNull();
  });

  it("finds them by phone however it's typed, and by status", async () => {
    const mona = await createStaff({ phone: "+201001234567" });
    await createStaff({ phone: "+201119998888" });
    await prisma.staff.update({ where: { id: mona.id }, data: { status: "SUSPENDED" } });

    for (const typed of ["0100 123 4567", "+20 100 123", "1001234567"]) {
      expect((await staffPage(`?q=${encodeURIComponent(typed)}`)).data.map((s) => s.id)).toEqual([
        mona.id,
      ]);
    }
    expect((await staffPage("?status=SUSPENDED")).data.map((s) => s.id)).toEqual([mona.id]);
  });
});

describe("finding customers", () => {
  it("finds them by name, and leaves deleted ones out", async () => {
    const ahmed = await createCustomer({ phone: "+201001110000" });
    const gone = await createCustomer({ phone: "+201002220000" });
    await prisma.customer.update({
      where: { id: gone.id },
      data: { deletedAt: new Date(), phone: null },
    });

    const all = await customerPage();
    expect(all.data.map((c) => c.id)).toEqual([ahmed.id]);
    expect((await customerPage("?q=ahm")).data.map((c) => c.id)).toEqual([ahmed.id]);
    expect((await customerPage("?q=nobody")).data).toEqual([]);
  });

  it("is for signed-in admins only", async () => {
    const res = await router.request("/v1/admin/customers", { headers: { "X-Hagz-Admin": "1" } });
    expect(res.status).toBe(401);
  });
});
