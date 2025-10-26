import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";

import Button from "@/app/components/base/Button";
import { updateInvitation } from "@/app/utils/api/client";
import { Invitation } from "@/app/utils/types/invitation";

export default function Pending({ data } : { data: Omit<Invitation, "email"> }) {
    const router = useRouter();

    const expiresAt = format(data.expiresAt, "MMMM do, yyyy h:mm a");
    const issuer = data.issuer.user;
    const token = data.token;

    const mutation = useMutation({
        mutationFn: (action: "ACCEPT" | "REJECT") => updateInvitation(action, token),
        mutationKey: ["invitation", token],
        onSuccess: () => router.push("/dashboard/pitches")
    });

    // Provide the user with a message that redirects them to /auth/manager/sign-up?token=
    // This will automatically accept the invitation on sign-up.

    if (data.requiresUser) {
        return (
            <div className="h-screen relative flex flex-col gap-y-10 items-center justify-around w-full px-8 py-16 text-sm text-center">
                <div className="flex flex-col gap-y-1">
                    <h1 className="text-xl font-semibold">Hagz for Managers</h1>
                    <p className="text-gray-500 text-[0.8125rem]">Welcome to Hagz, {data.firstName}! You have been invited by {issuer.firstName} to help manage &apos;{data.pitch.name}&apos;.</p>
                </div>
                <div className="w-108 bg-gray-50 rounded-md border-[1px] border-gray-200 p-6">
                    <div className="flex flex-col gap-y-0.5 text-left">
                        <span className="text-gray-500 text-xs">Expires at {expiresAt}.</span>
                        <h3 className="font-medium text-[0.9rem]">Create An Account</h3>
                    </div>
                    <div className="flex flex-col gap-y-5 items-center justify-center my-4">
                        <div className="size-12 rounded-full bg-blue-800 flex items-center justify-center">
                            <span className="text-white text-[1.05rem] font-medium">{issuer.firstName[0].toUpperCase()}</span>
                        </div>
                        <h2 className="text-[0.925rem] font-medium">{issuer.firstName} {issuer.lastName} has invited you to help them manage &apos;{data.pitch.name}&apos;.</h2>
                        <p className="text-gray-500 text-[0.8rem]">The email {issuer.firstName} has associated with the invitation does not have a user account yet. Please use the link below to create an account and accept the invitation.</p>
                        <Link href={`/auth/manager/sign-up?token=${data.token}`} target="_blank" className="mt-2"> 
                            <Button className="bg-black! border-black! hover:bg-gray-800! hover:border-gray-800! text-white">
                                <span className="text-xs">Create Account</span>
                            </Button>
                        </Link>
                    </div>
                </div>
                <div className="flex items-center gap-x-8 text-[0.8125rem]">
                    <Link href="/" className="text-gray-500 hover:underline">For Managers</Link>
                    <Link href="/" className="text-gray-500 hover:underline">Privacy Policy</Link>
                    <Link href="/" className="text-gray-500 hover:underline">Terms & Conditions</Link>
                    <Link href="/" className="text-gray-500 hover:underline">About Us</Link>
                </div>
                <span className="absolute bottom-6 right-6 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
            </div>
        )
    }

    // If there already is a user account with the specified email, then check the incoming accessToken and get the email.
    // If the emails do not match, provide the user with a message that redirects them to /auth/sign-in

    // If the emails match, provide them with an interface that shows them the invitation details and allows them to either accept or decline.

    if (data.requiresAuth) {
        return (
            <div className="h-screen relative flex flex-col gap-y-10 items-center justify-around w-full px-8 py-16 text-sm text-center">
                <div className="flex flex-col gap-y-1">
                    <h1 className="text-xl font-semibold">Hagz for Managers</h1>
                    <p className="text-gray-500 text-[0.8125rem]">Welcome to Hagz! You have been invited by {issuer.firstName} to help manage &apos;{data.pitch.name}&apos;.</p>
                </div>
                <div className="w-108 bg-gray-50 rounded-md border-[1px] border-gray-200 p-6">
                    <div className="flex flex-col gap-y-0.5 text-center mb-5 mt-3">
                        <span className="text-gray-500 text-xs">Expires at {expiresAt}.</span>
                        <h3 className="font-medium text-[0.9rem]">User Not Signed In</h3>
                    </div>
                    <div className="flex flex-col gap-y-5 items-center justify-center my-4">
                        <div className="size-12 rounded-full bg-blue-800 flex items-center justify-center">
                            <span className="text-white text-[1.05rem] font-medium">{issuer.firstName[0].toUpperCase()}</span>
                        </div>
                        <h2 className="text-[0.925rem] font-medium">{issuer.firstName} {issuer.lastName} has invited you to help them manage &apos;{data.pitch.name}&apos;.</h2>
                        <p className="text-gray-500 text-[0.8rem]">The email {issuer.firstName} has associated with the invitation already has an account. Please use the link below to sign in with the correct account and accept the invitation.</p>
                        <Link href={`/auth/sign-in?callback=${encodeURIComponent(`/invitation?token=${data.token}`)}`} target="_blank" className="mt-2"> 
                            <Button className="bg-black! border-black! hover:bg-gray-800! hover:border-gray-800! text-white">
                                <span className="text-xs">Sign In</span>
                            </Button>
                        </Link>
                    </div>
                </div>
                <div className="flex items-center gap-x-8 text-[0.8125rem]">
                    <Link href="/" className="text-gray-500 hover:underline">For Managers</Link>
                    <Link href="/" className="text-gray-500 hover:underline">Privacy Policy</Link>
                    <Link href="/" className="text-gray-500 hover:underline">Terms & Conditions</Link>
                    <Link href="/" className="text-gray-500 hover:underline">About Us</Link>
                </div>
                <span className="absolute bottom-6 right-6 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
            </div>
        )
    };

    return (
        <div className="h-screen relative flex flex-col gap-y-10 items-center justify-around w-full px-8 py-16 text-sm text-center">
            <div className="flex flex-col gap-y-1">
                <h1 className="text-xl font-semibold">Hagz for Managers</h1>
                <p className="text-gray-500 text-[0.8125rem]">Welcome to Hagz, {data.firstName}! You have been invited by {issuer.firstName} to help manage &apos;{data.pitch.name}&apos;.</p>
            </div>
            <div className="w-108 bg-gray-50 rounded-md border-[1px] border-gray-200 p-6">
                <div className="flex flex-col gap-y-0.5 text-center mb-5 mt-3">
                    <span className="text-gray-500 text-xs">Expires at {expiresAt}.</span>
                    <h3 className="font-medium text-[0.9rem]">Signed In as {data.firstName}</h3>
                </div>
                <div className="flex flex-col gap-y-5 items-center justify-center my-4">
                    <div className="size-12 rounded-full bg-blue-800 flex items-center justify-center">
                        <span className="text-white text-[1.05rem] font-medium">{issuer.firstName[0].toUpperCase()}</span>
                    </div>
                    <h2 className="text-[0.925rem] font-medium">{issuer.firstName} {issuer.lastName} has invited you to help them manage &apos;{data.pitch.name}&apos;.</h2>
                    <p className="text-gray-500 text-[0.8rem] leading-relaxed">
                        By accepting this invitation, you&apos;ll gain access to manage schedules, bookings, and other operations. If you&apos;re not ready or don&apos;t recognize this request, you can safely reject it. This invitation will remain valid until {expiresAt}.
                    </p>
                </div>
                <div className="flex items-center justify-center gap-x-2 mt-8 mb-4">
                    <button onClick={() => mutation.mutate("REJECT")} className="flex items-center gap-x-1 rounded-full px-6 py-2.5 text-black bg-white border-[1px] border-red-700 text-red-700 bg-red-50 hover:bg-red-700/5 transition-colors cursor-pointer text-[0.8125rem]">
                        <span className="text-xs">Reject</span>
                    </button>
                    <span className="text-[0.8rem] text-gray-500 mx-1">or</span>
                    <Button onClick={() => mutation.mutate("ACCEPT")} className="px-5! py-2.5!">
                        <span className="text-xs">Accept</span>
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-x-8 text-[0.8125rem]">
                <Link href="/" className="text-gray-500 hover:underline">For Managers</Link>
                <Link href="/" className="text-gray-500 hover:underline">Privacy Policy</Link>
                <Link href="/" className="text-gray-500 hover:underline">Terms & Conditions</Link>
                <Link href="/" className="text-gray-500 hover:underline">About Us</Link>
            </div>
            <span className="absolute bottom-6 right-6 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
        </div>
    )
}