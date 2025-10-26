import Link from "next/link";
import { IoSearchSharp } from "react-icons/io5";
import { IoMdNotificationsOutline } from "react-icons/io";

export default function Navigation({ user } : { user: { firstName: string, lastName: string, email: string } }) {
    return (
        <nav className="w-full lg:w-[calc(100%-14rem)] fixed right-0 flex border-b-[1px] border-gray-200 bg-white z-99 min-h-16 text-sm">
            <div className="flex-1 flex items-center w-full px-4">
                <div className="flex items-center gap-x-4 w-full">
                    <div className="flex items-center justify-between w-full border-r-[1px] border-gray-200">
                        <div className="w-96 relative">
                            <IoSearchSharp className="size-4 absolute top-1/2 left-2 -translate-y-1/2 text-gray-400"/>
                            <input type="text" className="w-full border-[1px] border-gray-200 rounded-lg py-2 pr-2 pl-8" placeholder="Search"/>
                        </div>
                        <div className="flex items-center gap-x-2 px-4">
                            <Link href="/dashboard/notifications" className="border-[1px] border-gray-200 flex items-center justify-center rounded-lg size-8 hover:bg-gray-100 transition-colors">
                                <IoMdNotificationsOutline className="size-4 text-black"/>
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="pl-4">
                    <div className="flex items-center gap-x-3">
                        <Link href="/account">
                            <div className="size-7 rounded-full bg-black"></div>
                        </Link>
                        <div className="flex flex-col text-xs">
                            <span className="font-medium">{user.firstName} {user.lastName}</span>
                            <span className="text-gray-700">{user.email}</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}