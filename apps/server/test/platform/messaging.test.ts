import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/platform/logger/logger";
import { messaging, selectProvider } from "@/platform/messaging/messaging";
import { consoleProvider, unconfiguredProvider } from "@/platform/messaging/providers";
import { outbox } from "../support/messaging";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("messaging provider", () => {
  it.each([
    [{ NODE_ENV: "development", APP_ENV: "development" }, consoleProvider],
    [{ NODE_ENV: "production", APP_ENV: "staging" }, unconfiguredProvider],
    [{ NODE_ENV: "production", APP_ENV: "production" }, unconfiguredProvider],
  ] as const)("picks the right provider for %o", (environment, expected) => {
    expect(selectProvider(environment)).toBe(expected);
  });

  it("records what tests send, so they can read codes back", async () => {
    await messaging.sendVerificationCode({
      phone: "+201001234567",
      code: "123456",
      language: "AR",
    });
    await messaging.sendVerificationCode({
      phone: "+201001234567",
      code: "654321",
      language: "AR",
    });

    expect(outbox.lastCodeFor("+201001234567")).toBe("654321");
    expect(outbox.lastCodeFor("+201007654321")).toBeUndefined();
  });

  it("logs the code in development instead of sending it", async () => {
    const info = vi.spyOn(logger, "info");

    await consoleProvider.sendVerificationCode({
      phone: "+201001234567",
      code: "123456",
      language: "EN",
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ code: "123456" }),
      expect.stringContaining("development"),
    );
  });

  it("refuses to pretend in staging and production until Meta is wired in", async () => {
    await expect(
      unconfiguredProvider.sendVerificationCode({
        phone: "+201001234567",
        code: "123456",
        language: "AR",
      }),
    ).rejects.toMatchObject({ status: 503, code: "MESSAGING_UNAVAILABLE" });
  });
});
