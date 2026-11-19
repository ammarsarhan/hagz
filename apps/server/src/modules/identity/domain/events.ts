// AccountEvent types this module writes. The admin who acted is `adminId`; the account it was done
// to is the row's one subject. The data holds the admin's reason where they give one.

// A customer suspended or reactivated by an admin.
export const CUSTOMER_SUSPENDED = "CUSTOMER_SUSPENDED";
export const CUSTOMER_REACTIVATED = "CUSTOMER_REACTIVATED";
// Another admin suspended or reactivated.
export const ADMIN_SUSPENDED = "ADMIN_SUSPENDED";
export const ADMIN_REACTIVATED = "ADMIN_REACTIVATED";
// Another admin's authenticator forgotten, and a password reset link emailed to them.
export const ADMIN_AUTHENTICATOR_RESET = "ADMIN_AUTHENTICATOR_RESET";
export const ADMIN_PASSWORD_RESET_SENT = "ADMIN_PASSWORD_RESET_SENT";
// A venue owner let reset their password by phone, once support had checked who they are.
export const STAFF_PASSWORD_RESET_GRANTED = "STAFF_PASSWORD_RESET_GRANTED";
