import { Link } from "@tanstack/react-router";
import { TbExternalLink } from "react-icons/tb";

export default function ProfileAside() {
    return (
        <aside className="px-4 py-10 h-full flex flex-col justify-between">
            <div className="flex flex-col gap-y-4">
                <h1 className="font-medium text-lg">Profile</h1>
                <div className="flex flex-col gap-y-1 text-nowrap">
                    <Link 
                        to="/profile" 
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        General
                    </Link>
                    <Link 
                        to="/profile/settings"
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        Preferences
                    </Link>
                    <Link 
                        to="/profile/history" 
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        Bookings & Payments
                    </Link>
                    <Link 
                        to="/profile/notifications"
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        Notifications
                    </Link>
                    <Link 
                        to="/profile/sessions" 
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        Signed-in Devices
                    </Link>
                    <Link 
                        to="/profile/referrals" 
                        className="py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        Refer a friend
                    </Link>
                    <Link 
                        to="/policy" 
                        className="flex items-center gap-x-2 py-2 pl-4 pr-12 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                    >
                        <span>License & Policy</span>
                        <TbExternalLink className="size-4"/>
                    </Link>
                </div>
            </div>
            <span className="text-gray-500 text-xs">© Hagz 2026.<br/>All rights reserved.</span>
        </aside>
    )
}