import type { ContentfulStatusCode } from "hono/utils/http-status";

// Create a set of standardized error codes that can be used to define and handle issues gracefully on the client-side.
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  USER_PHONE_ALREADY_EXISTS: "USER_PHONE_ALREADY_EXISTS",
  USER_PHONE_DOES_NOT_EXIST: "USER_PHONE_DOES_NOT_EXIST",
  USER_ACCOUNT_NOT_ACTIVE: "USER_ACCOUNT_NOT_ACTIVE",
  USER_ID_DOES_NOT_EXIST: "USER_ID_DOES_NOT_EXIST",
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
