import Form from "@/app/auth/verify/send/form";
import extractCookies from "@/app/utils/cookies";

export default async function Page() {
    const { header } = await extractCookies(); // Use the extractCookies function to get the accessToken and refreshToken from the incoming request.

    const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`;

    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            Cookie: header
        },
        credentials: "include",
        cache: "no-store" // Prevent caching for auth-sensitive data
    });

    const data = await res.json();

    return (
        <Form status={res.status} resend={data.resend} message={data.message}/>
    )
}

// Before mounting, use the accessToken to fetch the current verification status.
// User can only have two verification states, either they're in the state to send an email, or they're not.

// Create a route on the backend to fetch the initial user verification status before going through the trouble of trying to verify them.

// User can not send a verification email if:
// 1) Their user/account no longer exists.
// 2) Their status is anything other than unverified (DELETED, SUSPENDED, ACTIVE).
// 3) Their user already has EMAIL within their verified contact methods.

// User can send a verification email if:
// 1) They are verifying for the first time, in that case we need to:
// - Generate the token and expected expiry date.
// - Update their user account to contain a verificationToken and a verificationExpiresAt.
// - Call a function to add a BullMQ message that:
//   uses the sendEmail function to send an email and ensure that it retries in case the email service fails.
// - And if for some reason any of these steps fails, we need to make sure that a suitable response is sent to the user, 
//   and that they are allowed to send a subsequent request within rate limiter limits.

// 2) They already have a token and expiryDate issued:
// - The verificationToken will be valid for 10 minutes from the issuing date.
// - We need to set a cooldown between each sendEmail attempt and the next of 3 minutes.
// - We need to identify whether that expiryDate has been reached yet or not.
// - Between each email and the next, we want to give the first verificationToken a chance 
//   to avoid overloading the database with requests to update the user record every time we need to send a new link.

// - We don't want to issue a new verificationToken when our token is still valid.
// - Check if we are within the limit we want of 3 minutes per request through the middleware.
// - In that case, go through the original flow and send the original token limit until it expires.

// To do that, we need to fetch the user record using the sub from the accessToken and:
// - Check the expiryDate field and compare it against our current time.
// - If it passes, add a message to BullMQ and return an OK response.

// Otherwise, if our verificationToken is no longer valid:
// - Generate a new verificationToken and expiryDate
// - Update the user record to add the new verificationToken and the updated expiryDate.
// - Add a message to BullMQ and return an OK response.

