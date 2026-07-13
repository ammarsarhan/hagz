import { ErrorCode } from "@/shared/lib/utils/error";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    // Generic
    UNAUTHORIZED: "You need to sign in to continue.",
    VALIDATION_FAILED: "Some information you entered isn't valid.",
    INTERNAL_SERVER_ERROR: "Something went wrong on our end. Please try again.",

    // Authentication
    USER_ROLE_INVALID: "This account type isn't supported here.",
    USER_PHONE_ALREADY_EXISTS: "An account with this phone number already exists.",
    USER_PHONE_DOES_NOT_EXIST: "We couldn't find an account with that phone number.",
    USER_ID_DOES_NOT_EXIST: "We couldn't find that account.",
    USER_NOT_AUTHENTICATED: "Please sign in to continue.",
    USER_SESSION_EXPIRED: "Your session has expired. Please sign in again.",
    USER_SESSION_NOT_FOUND: "Your session couldn't be found. Please sign in again.",
    USER_SESSION_CONFLICT: "You're already signed in elsewhere. Please sign in again.",
    USER_NOT_ACTIVE: "This account is no longer active.",
    USER_PREFERENCES_NOT_FOUND: "We couldn't load your account preferences.",
    USER_AVATAR_NOT_FOUND: "We couldn't find your profile photo.",
    USER_AVATAR_CONFIRMATION_FAILED: "We couldn't confirm your profile photo upload. Please try again.",
    PROFILE_ACCESS_FORBIDDEN: "You don't have access to this profile.",

    // Pitch
    PITCH_DRAFT_EXISTS: "You already have a draft pitch in progress.",
    PITCH_NOT_ACTIVE: "This pitch isn't currently active.",
    PITCH_NOT_EDITABLE: "This pitch can't be edited right now.",
    PITCH_NOT_LIVE: "This pitch isn't live yet.",
    PITCH_UNDER_MAINTENANCE: "This pitch is temporarily under maintenance.",
    PITCH_ACCESS_FORBIDDEN: "You don't have access to this pitch.",
    PITCH_NOT_FOUND: "We couldn't find that pitch.",
    PITCH_AMENITY_NOT_FOUND: "That amenity couldn't be found.",
    PITCH_AMENITY_REQUIRED: "Please add at least one amenity.",
    PITCH_AMENITY_LIMIT_EXCEEDED: "You've reached the limit for amenities.",
    PITCH_AMENITY_DUPLICATE: "That amenity has already been added.",
    PITCH_CREATE_LIMIT_EXCEEDED: "You've reached the limit for creating pitches.",
    PITCH_MEDIA_NOT_FOUND: "We couldn't find that pitch media.",
    PITCH_MEDIA_CONFIRMATION_FAILED: "We couldn't confirm your media upload. Please try again.",
    PITCH_MEDIA_BELOW_MINIMUM: "Please add more photos before continuing.",
    PITCH_INVITATION_ALREADY_EXISTS: "An invitation has already been sent.",
    PITCH_INVITATION_NOT_FOUND: "We couldn't find that invitation.",
    PITCH_INVITATION_NOT_PENDING: "That invitation is no longer pending.",
    PITCH_STAFF_ALREADY_EXISTS: "This person is already on your staff.",
    PITCH_STAFF_NOT_FOUND: "We couldn't find that staff member.",
    PITCH_GROUND_REQUIRED: "Please add at least one ground before continuing.",
    PITCH_MEDIA_MINIMUM_REQUIRED: "Please add the required number of photos.",
    PITCH_MEDIA_LIMIT_EXCEEDED: "You've reached the limit for photos.",

    // Ground
    GROUND_NOT_FOUND: "We couldn't find that ground.",
    GROUND_NOT_ACTIVE: "This ground isn't currently active.",
    GROUND_CREATE_LIMIT_EXCEEDED: "You've reached the limit for creating grounds.",
    GROUND_ALREADY_EXISTS: "This ground already exists.",
    GROUND_SETTINGS_MISSING: "Ground settings are missing. Please complete them first.",
    GROUND_SETTINGS_INVALID: "Some ground settings aren't valid.",
    GROUND_SETTINGS_FORBIDDEN: "You don't have permission to change these settings.",
    GROUND_SCHEDULE_MISSING: "This ground doesn't have a schedule set up yet.",
    GROUND_SCHEDULE_DOES_NOT_EXIST: "That schedule couldn't be found.",
    GROUND_SCHEDULE_NOT_ACTIVE: "This schedule isn't currently active.",
    GROUND_SCHEDULE_GENERATING_CONFLICT: "The schedule is still being generated. Please try again shortly.",
    GROUND_SLOT_NOT_FOUND: "We couldn't find that time slot.",
    GROUND_SLOT_NOT_EDITABLE: "This time slot can't be edited right now.",
    GROUND_BOOKINGS_CONFLICT: "This conflicts with an existing booking.",
    GROUND_TRANSITION_INVALID: "That change isn't allowed right now.",

    // Booking
    BOOKING_NOT_FOUND: "We couldn't find that booking.",
    BOOKING_DURATION_INVALID: "Please select a valid booking duration.",
    BOOKING_WINDOW_INVALID: "That booking time isn't available.",
    BOOKING_PAYMENT_METHOD_NOT_ALLOWED: "That payment method isn't available for this booking.",
    BOOKING_SLOTS_NOT_AVAILABLE: "Those time slots are no longer available.",
    BOOKING_GUEST_NOT_ALLOWED: "Guest bookings aren't allowed here.",
    BOOKING_AUTO_EXPIRY_LIMIT_HIT: "You've reached the limit for expired bookings.",
    BOOKING_TRANSITION_INVALID: "That booking change isn't allowed.",
    BOOKING_ACCESS_FORBIDDEN: "You don't have access to this booking.",
    BOOKING_RESCHEDULING_LIMIT_EXCEEDED: "You've reached the limit for rescheduling this booking.",

    // Reviews
    REVIEW_ALREADY_EXISTS: "You've already left a review.",
    REVIEW_NOT_FOUND: "We couldn't find that review.",

    // Notifications
    NOTIFICATION_NOT_FOUND: "We couldn't find that notification.",
};

export const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function getErrorMessage(error: { code?: ErrorCode; message: string; fields?: { field: string; message: string }[] }): string {
    if (error.fields?.length) {
        return error.fields.map(f => f.message).join("\n");
    };

    if (error.code && ERROR_MESSAGES[error.code]) {
        return ERROR_MESSAGES[error.code]!;
    };

    return error.message || DEFAULT_ERROR_MESSAGE;
}

export type ClientError = {
    success: false;
    error: {
        code?: ErrorCode;
        message: string;
        fields?: { field: string; message: string }[];
    };
};

export async function parseClientError(res: { json: () => Promise<unknown> }): Promise<ClientError["error"]> {
    const body = (await res.json().catch(() => null)) as ClientError | null;
    return body?.error ?? { message: "Something went wrong. Please try again." };
}
