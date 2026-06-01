import { hc } from 'hono/client'
import { getRequest, getResponseHeaders } from '@tanstack/react-start/server'
import type { AppType } from '@/index';

export interface ErrorResponse {
  success: false;
  error: {
    code?: string;
    message: string;
    fields?: { field: string; message: string }[];
  };
};

export const ERROR_CODES: Record<string, string> = {
  // Generic
  UNAUTHORIZED: "You are not authorized to perform this action.",
  VALIDATION_FAILED: "Some fields are invalid. Please check your input and try again.",
  INTERNAL_SERVER_ERROR: "Something went wrong on our end. Please try again later.",

  // Authentication
  USER_PHONE_ALREADY_EXISTS: "An account with this phone number already exists.",
  USER_PHONE_DOES_NOT_EXIST: "No account found with this phone number.",
  USER_ID_DOES_NOT_EXIST: "This account no longer exists.",
  USER_NOT_AUTHENTICATED: "You need to be signed in to do this.",
  USER_SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  USER_SESSION_NOT_FOUND: "Your session was not found. Please sign in again.",
  USER_SESSION_CONFLICT: "You are already signed in on another device.",
  USER_NOT_ACTIVE: "Your account has been deactivated. Please contact support.",
  USER_PREFERENCES_NOT_FOUND: "Your preferences could not be found.",

  // Pitch
  PITCH_DRAFT_EXISTS: "You already have a pitch draft in progress.",
  PITCH_NOT_ACTIVE: "This pitch is not currently active.",
  PITCH_NOT_EDITABLE: "This pitch cannot be edited at this time.",
  PITCH_NOT_LIVE: "This pitch is not live yet.",
  PITCH_UNDER_MAINTENANCE: "This pitch is currently under maintenance.",
  PITCH_ACCESS_FORBIDDEN: "You do not have permission to access this pitch.",
  PITCH_NOT_FOUND: "This pitch could not be found.",
  PITCH_AMENITY_NOT_FOUND: "The selected amenity could not be found.",
  PITCH_AMENITY_REQUIRED: "At least one amenity is required.",
  PITCH_AMENITY_LIMIT_EXCEEDED: "You have reached the maximum number of amenities.",
  PITCH_AMENITY_DUPLICATE: "This amenity has already been added.",
  PITCH_CREATE_LIMIT_EXCEEDED: "You have reached the maximum number of pitches allowed.",
  PITCH_MEDIA_NOT_FOUND: "The selected media could not be found.",
  PITCH_MEDIA_CONFIRMATION_FAILED: "Media confirmation failed. Please try uploading again.",
  PITCH_MEDIA_BELOW_MINIMUM: "Please upload the minimum required number of photos.",
  PITCH_INVITATION_ALREADY_EXISTS: "An invitation has already been sent to this person.",
  PITCH_INVITATION_NOT_FOUND: "This invitation could not be found.",
  PITCH_INVITATION_NOT_PENDING: "This invitation is no longer pending.",
  PITCH_STAFF_ALREADY_EXISTS: "This person is already a staff member.",
  PITCH_STAFF_NOT_FOUND: "This staff member could not be found.",
  PITCH_GROUND_REQUIRED: "At least one ground is required.",
  PITCH_MEDIA_MINIMUM_REQUIRED: "Please upload at least the minimum required number of photos.",
  PITCH_MEDIA_LIMIT_EXCEEDED: "You have reached the maximum number of photos allowed.",

  // Ground
  GROUND_NOT_FOUND: "This ground could not be found.",
  GROUND_NOT_ACTIVE: "This ground is not currently active.",
  GROUND_CREATE_LIMIT_EXCEEDED: "You have reached the maximum number of grounds allowed.",
  GROUND_ALREADY_EXISTS: "A ground with these details already exists.",
  GROUND_SETTINGS_MISSING: "Ground settings are incomplete. Please fill out all required fields.",
  GROUND_SETTINGS_INVALID: "Some ground settings are invalid. Please review and try again.",
  GROUND_SETTINGS_FORBIDDEN: "You do not have permission to change these settings.",
  GROUND_SCHEDULE_MISSING: "A schedule is required for this ground.",
  GROUND_SCHEDULE_DOES_NOT_EXIST: "This schedule could not be found.",
  GROUND_SCHEDULE_NOT_ACTIVE: "This schedule is not currently active.",
  GROUND_SCHEDULE_GENERATING_CONFLICT: "A conflict was detected while generating the schedule. Please review your settings.",
  GROUND_SLOT_NOT_FOUND: "This time slot could not be found.",
  GROUND_SLOT_NOT_EDITABLE: "This time slot cannot be edited.",
  GROUND_BOOKINGS_CONFLICT: "This change conflicts with existing bookings.",
  GROUND_TRANSITION_INVALID: "This ground cannot be moved to the requested status.",

  // Booking
  BOOKING_NOT_FOUND: "This booking could not be found.",
  BOOKING_DURATION_INVALID: "The selected duration is not valid for this ground.",
  BOOKING_WINDOW_INVALID: "Bookings cannot be made this far in advance or this close to the start time.",
  BOOKING_PAYMENT_METHOD_NOT_ALLOWED: "This payment method is not accepted for this ground.",
  BOOKING_SLOTS_NOT_AVAILABLE: "The selected time slot is no longer available.",
  BOOKING_GUEST_NOT_ALLOWED: "Guest bookings are not allowed for this ground.",
  BOOKING_AUTO_EXPIRY_LIMIT_HIT: "You have too many unpaid bookings. Please complete or cancel them before making a new one.",
  BOOKING_TRANSITION_INVALID: "This booking cannot be moved to the requested status.",
  BOOKING_ACCESS_FORBIDDEN: "You do not have permission to access this booking.",
  BOOKING_RESCHEDULING_LIMIT_EXCEEDED: "This booking has been rescheduled the maximum number of times allowed.",

  // Notifications
  NOTIFICATION_NOT_FOUND: "This notification could not be found.",
};

// Change this later in production to read from the .env variable.
const isServer = typeof window === 'undefined';
const target = isServer ? 'http://api:8080' : 'http://localhost:8080';

const appFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);

  if (isServer) {
    const request = getRequest();
    const cookie = request?.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
  };

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status !== 401) return res;

  const refresh = await fetch(`${target}/auth/refresh`, {
    method: 'POST',
    headers: isServer ? { cookie: headers.get('cookie') ?? '' } : undefined,
    credentials: 'include',
  });

  if (!refresh.ok) return res;

  // Forward Set-Cookie from the refresh response to the browser.
  if (isServer) {
    const headers = getResponseHeaders();
    const setCookie = refresh.headers.get('set-cookie');

    if (setCookie) {
      headers.append('set-cookie', setCookie);
    };
  };

  // Also forward the new cookie into the retry request.
  if (isServer) {
    const setCookie = refresh.headers.get('set-cookie');

    if (setCookie) {
      // Extract the cookie value to use in the retry.
      const updatedCookie = setCookie.split(';')[0];
      const existingCookie = headers.get('cookie') ?? '';

      headers.set('cookie', existingCookie ? `${existingCookie}; ${updatedCookie}` : updatedCookie);
    }
  };

  return fetch(input, { ...init, headers, credentials: 'include' });
};
export const client = hc<AppType>(target, {
  fetch: appFetch
});
