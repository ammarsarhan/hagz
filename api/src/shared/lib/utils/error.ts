import type { ContentfulStatusCode } from "hono/utils/http-status";

// Create a set of standardized error codes that can be used to define and handle issues gracefully on the client-side.
export const ERROR_CODES = {
  // Generic
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",

  // Authentication
  USER_PHONE_ALREADY_EXISTS: "USER_PHONE_ALREADY_EXISTS",
  USER_PHONE_DOES_NOT_EXIST: "USER_PHONE_DOES_NOT_EXIST",
  USER_ACCOUNT_NOT_ACTIVE: "USER_ACCOUNT_NOT_ACTIVE",
  USER_ID_DOES_NOT_EXIST: "USER_ID_DOES_NOT_EXIST",
  USER_NOT_AUTHENTICATED: "USER_NOT_AUTHENTICATED",
  USER_SESSION_EXPIRED: "USER_SESSION_EXPIRED",
  USER_NOT_ACTIVE: "USER_NOT_ACTIVE",
  
  // Pitch
  PITCH_DRAFT_EXISTS: "PITCH_DRAFT_EXISTS",
  PITCH_NOT_ACTIVE: "PITCH_NOT_ACTIVE",
  PITCH_ACCESS_FORBIDDEN: "PITCH_ACCESS_FORBIDDEN",
  PITCH_NOT_FOUND: "PITCH_NOT_FOUND",
  PITCH_AMENITY_NOT_FOUND: "PITCH_AMENITY_NOT_FOUND",
  PITCH_AMENITY_LIMIT_EXCEEDED: "PITCH_AMENITY_LIMIT_EXCEEDED",
  PITCH_AMENITY_DUPLICATE: "PITCH_AMENITY_DUPLICATE",
  PITCH_CREATE_LIMIT_EXCEEDED: "PITCH_CREATE_LIMIT_EXCEEDED",
  PITCH_MEDIA_NOT_FOUND: "PITCH_MEDIA_NOT_FOUND",
  PITCH_MEDIA_CONFIRMATION_FAILED: "PITCH_MEDIA_CONFIRMATION_FAILED",
  PITCH_MEDIA_BELOW_MINIMUM: "PITCH_MEDIA_BELOW_MINIMUM",
  PITCH_INVITATION_ALREADY_EXISTS: "PITCH_INVITATION_ALREADY_EXISTS",
  PITCH_INVITATION_NOT_FOUND: "PITCH_INVITATION_NOT_FOUND",
  PITCH_INVITATION_NOT_PENDING: "PITCH_INVITATION_NOT_PENDING",
  PITCH_STAFF_ALREADY_EXISTS: "PITCH_STAFF_ALREADY_EXISTS",
  PITCH_STAFF_NOT_FOUND: "PITCH_STAFF_NOT_FOUND",

  // Ground
  GROUND_NOT_FOUND: "GROUND_NOT_FOUND",
  GROUND_CREATE_LIMIT_EXCEEDED: "GROUND_CREATE_LIMIT_EXCEEDED",
  GROUND_ALREADY_EXISTS: "GROUND_ALREADY_EXISTS",
  GROUND_SETTINGS_MISSING: "GROUND_SETTINGS_MISSING",
  GROUND_SCHEDULE_MISSING: "GROUND_SCHEDULE_MISSING",
  GROUND_SCHEDULE_DOES_NOT_EXIST: "GROUND_SCHEDULE_DOES_NOT_EXIST",
  GROUND_SCHEDULE_NOT_ACTIVE: "GROUND_SCHEDULE_NOT_ACTIVE",
  GROUND_SLOTS_GENERATING_CONFLICT: "GROUND_SLOTS_GENERATING_CONFLICT"
} as const;

export type ErrorCode =
  (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Generic AppError class that will be used to parent/construct throwable error classes.
export default class AppError extends Error {
    public readonly statusCode: ContentfulStatusCode;
    public readonly isOperational: boolean;
    public readonly code: ErrorCode;

    constructor (statusCode: ContentfulStatusCode, message: string, code: ErrorCode, isOperational: boolean = true) {
       super(message);

       this.statusCode = statusCode;
       this.code = code;
       this.isOperational = isOperational;

       Error.captureStackTrace(this, this.constructor);
    }
};

export class BadRequestError extends AppError {
  constructor(message: string, code: ErrorCode) {
    super(400, message, code);
  }
};

export class UnauthorizedError extends AppError {
  constructor( message: string = 'Unauthorized', code: ErrorCode,) {
    super(401, message, code);
  }
};

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: ErrorCode) {
    super(403, message, code);
  }
};

export class NotFoundError extends AppError {
  constructor(message: string, code: ErrorCode) {
    super(404, message, code);
  }
};

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode) {
    super(409, message, code);
  }
};

export class ValidationError extends AppError {
  constructor(message: string, code: ErrorCode) {
    super(422, message, code);
  }
};

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: ErrorCode = "INTERNAL_SERVER_ERROR") {
    super(500, message, code, false);
  }
};
