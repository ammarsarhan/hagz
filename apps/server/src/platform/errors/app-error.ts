// Statuses an AppError may carry. Kept to a list so a typo can't produce a 2xx error.
export type ErrorStatus =
  400 | 401 | 403 | 404 | 409 | 410 | 412 | 413 | 422 | 426 | 429 | 500 | 503;

export interface AppErrorInit {
  // Stable and machine-readable, e.g. "SLOT_UNAVAILABLE". Clients switch on it; never rename one.
  code: string;
  status: ErrorStatus;
  // For people. Clients must not parse it.
  detail: string;
  // Sent to the client as extra problem members, so never put internals or secrets here.
  extensions?: Record<string, unknown>;
  cause?: unknown;
}

// An expected failure with a known HTTP outcome. Anything else that is thrown is a bug and becomes a
// 500. No HTTP imports here: domain code throws these too.
export class AppError extends Error {
  readonly code: string;
  readonly status: ErrorStatus;
  readonly extensions: Record<string, unknown>;

  constructor({ code, status, detail, extensions = {}, cause }: AppErrorInit) {
    super(detail, { cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.extensions = extensions;
  }
}
