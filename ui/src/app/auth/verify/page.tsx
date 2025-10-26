import extractCookies from "@/app/utils/cookies";

export default async function Verify({ searchParams } : { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    // This page is intended to handle email verification when a user clicks on the verification link sent to their email.
    
    // Create a fetch request to verify the user's email.
    const { header } = await extractCookies();
    const { token } = await searchParams;

    const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`;

    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "POST", 
        headers: { 
            "Content-Type": "application/json",
            Cookie: header
        },
        credentials: "include",
        body: JSON.stringify({ token })
    });

    const data = await res.json();

    return (
        <div className="h-screen flex flex-col items-center justify-center gap-y-4 text-center px-4">
            <div className="flex flex-col gap-y-1.5">
                <h1 className="text-xl font-semibold">{data.title}</h1>
                <p className="text-gray-500 text-[0.8125rem]">{data.message}</p>
            </div>
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
        </div>
    )
}