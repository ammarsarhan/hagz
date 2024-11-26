import Link from "next/link"
import { LogOut } from "lucide-react"

export default function Profile ({email} : {email: string}) {
    return (
        <div className="flex items-center justify-between gap-4 px-2 py-4 text-sm rounded-md">
            <Link href="/">
                <div className="flex items-center gap-x-3">
                    <div className="w-5 h-5 bg-black rounded-full"></div>
                    <span>{email}</span>
                </div>
            </Link>
            <Link href="/auth/owner/sign-out">
                <LogOut className="w-4 h-4"/>
            </Link>
        </div>
    )
}