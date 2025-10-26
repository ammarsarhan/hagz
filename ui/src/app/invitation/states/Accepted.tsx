import Link from "next/link";
import { format } from "date-fns";
import { Invitation } from "@/app/utils/types/invitation";
import { FaRegCircleCheck } from "react-icons/fa6";

export default function Accepted({ data } : { data: Omit<Invitation, "email"> }) {
    const issuer = data.issuer.user;
    
    if (data.acceptedAt) {
        const acceptedAt = format(data.acceptedAt, "MMMM do, yyyy h:mm a");

        return (
            <div className="h-screen relative flex flex-col gap-y-10 items-center justify-around w-full px-8 py-16 text-sm text-center">
                <div className="flex flex-col gap-y-1">
                    <h1 className="text-xl font-semibold">Hagz for Managers</h1>
                    <p className="text-gray-500 text-[0.8125rem]">{data.firstName} {data.lastName} has already been added as a manager to &apos;{data.pitch.name}&apos; successfully.</p>
                </div>
                <div className="w-108 bg-gray-50 rounded-md border-[1px] border-gray-200 p-6">
                    <div className="flex flex-col gap-y-0.5 text-left">
                        <span className="text-gray-500 text-xs">Accepted on {acceptedAt}.</span>
                        <h3 className="font-medium text-[0.9rem]">Accepted Successfully</h3>
                    </div>
                    <div className="flex flex-col gap-y-5 items-center justify-center my-4">
                        <FaRegCircleCheck className="size-10 text-gray-500 my-2"/>
                        <h2 className="text-[0.925rem] font-medium">{issuer.firstName} {issuer.lastName} invited you to help them manage &apos;{data.pitch.name}&apos;.</h2>
                        <p className="text-gray-500 text-[0.8rem]">This invitation has already been accepted. If you feel like this is a mistake, please get in touch with {issuer.firstName} to issue you a new one.</p>
                        <Link href="/dashboard" className="text-blue-700 hover:underline text-[0.8125rem]">Back to dashboard</Link>
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
        );
    }
};