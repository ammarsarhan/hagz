import { afterEach, describe, expect, it, vi } from "vitest";
import { email, selectProvider } from "@/platform/email/email";
import { consoleProvider, unconfiguredProvider } from "@/platform/email/providers";
import { logger } from "@/platform/logger/logger";
import { mailbox } from "../support/email";

const invitation = (acceptUrl: string) => ({
  to: "sara@hagz.app",
  invitedBy: "Omar",
  acceptUrl,
  expiresAt: new Date("2026-10-30T12:00:00Z"),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("email provider", () => {
  it.each([
    [{ NODE_ENV: "development", APP_ENV: "development" }, consoleProvider],
    [{ NODE_ENV: "production", APP_ENV: "staging" }, unconfiguredProvider],
    [{ NODE_ENV: "production", APP_ENV: "production" }, unconfiguredProvider],
  ] as const)("picks the right provider for %o", (environment, expected) => {
    expect(selectProvider(environment)).toBe(expected);
  });

  it("records what tests send, so they can follow links", async () => {
    await email.sendAdminInvitation(invitation("https://example.test/a"));
    await email.sendAdminInvitation(invitation("https://example.test/b"));

    expect(mailbox.lastInvitationTo("sara@hagz.app")?.acceptUrl).toBe("https://example.test/b");
    expect(mailbox.lastInvitationTo("omar@hagz.app")).toBeUndefined();
  });

  it("logs the email in development instead of sending it", async () => {
    const info = vi.spyOn(logger, "info");
    await consoleProvider.sendAdminInvitation(invitation("https://example.test/a"));
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ acceptUrl: "https://example.test/a" }),
      expect.stringContaining("development"),
    );
  });

  it("refuses to pretend in staging and production until a provider is chosen", async () => {
    await expect(
      unconfiguredProvider.sendAdminInvitation(invitation("https://example.test/a")),
    ).rejects.toMatchObject({ status: 503, code: "EMAIL_UNAVAILABLE" });
  });
});
