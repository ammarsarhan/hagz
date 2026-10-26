import { MarketplaceList } from "@hagz/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { router } from "@/http/router";
import { resetDatabase } from "../../support/database";
import { createMarketplace } from "../../support/factories";

const list = async (headers: Record<string, string> = {}) => {
  const res = await router.request("/v1/marketplaces", { headers });
  expect(res.status).toBe(200);
  // The response must satisfy the published contract, not just look right.
  return MarketplaceList.parse(await res.json()).data;
};

beforeEach(async () => {
  await resetDatabase();
  await createMarketplace({ code: "SA", names: { EN: "Saudi Arabia" } });
  await createMarketplace({ code: "EG", names: { AR: "مصر", EN: "Egypt" } });
  await createMarketplace({ code: "AE", names: { EN: "UAE" }, isActive: false });
});

describe("GET /v1/marketplaces", () => {
  it("lists active marketplaces by code, in Arabic by default", async () => {
    const data = await list();

    expect(data.map((m) => [m.code, m.name])).toEqual([
      ["EG", "مصر"],
      ["SA", "Saudi Arabia"], // no Arabic name yet, so English
    ]);
    expect(data[0]).toEqual({
      code: "EG",
      name: "مصر",
      currency: "EGP",
      dialCode: "+20",
      timezone: "Africa/Cairo",
    });
  });

  it("follows Accept-Language", async () => {
    const data = await list({ "Accept-Language": "en-US,en;q=0.9,ar;q=0.8" });
    expect(data.map((m) => m.name)).toEqual(["Egypt", "Saudi Arabia"]);
  });

  it("falls back to Arabic for unsupported languages", async () => {
    const data = await list({ "Accept-Language": "fr" });
    expect(data[0]?.name).toBe("مصر");
  });
});
