export default function Verify() {
    return (
        <div className="flex-center h-screen text-xxs">
            <ol>
                <li>Using SSR, render the correct step.</li>
                <li>Initiate the process by providing a button that can be clicked and retried within a window.</li>
                <li>Button sends a mutation to the backend providing the accessToken.</li>
                <li>Backend uses this to both: 1) Generate an OTP and send it using the NotificationService. 2) Store the latest OTP generated as this is the only one that will be accepted.</li>
                <li>Return a response to the frontend verifying that the OTP has been sent.</li>
                <li>Frontend parses the response and either (if failed) allows the user to instantly send another request to the backend, or (if successful) provides an OTP input.</li>
                <li>User may retry if successful after 2 minutes. And they should be able to enter the OTP throught the UI.</li>
                <li>As soon as the input is filled, send a request to verify the user with the OTP stored in the database.</li>
                <li>If successful, redirect them to the intended role route.</li>
                <li>If failed, allow them to retry within limits.</li>
            </ol>
        </div>
    )
}