import Link from "next/link";
import Button from "@/app/components/base/Button";

export default function ErrorView({ title, message, children } : { title: string, message: string, children?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center gap-y-1.5 text-center fixed w-screen h-screen fixed bg-white top-0 left-0 z-9999 px-4">
            <h1 className="font-medium text-lg">{title}</h1>
            <div className="text-[0.8125rem] text-gray-500">
                <p>{message}</p>
                {children}
            </div>
            <Link href="/dashboard">
                <Button className="mt-3">
                    Back to dashboard
                </Button>
            </Link>
            <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gray-500 text-xs">© Hagz 2026, All rights reserved.</span>
        </div>
    )
}