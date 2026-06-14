import { Link } from "@tanstack/react-router";
import { TbExternalLink } from "react-icons/tb";

export default function AccountAside() {
    return (
        <aside className='w-60 shrink-0'>
            <div className="px-4 py-10 h-[calc(100%-5rem)] flex flex-col justify-between fixed top-20">
                <div className="flex flex-col gap-y-4">
                    <h1 className="font-medium text-lg">Account</h1>
                    <div className="flex flex-col gap-y-1 text-nowrap">
                        <Link 
                            to="/account" 
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Profile
                        </Link>
                        <Link 
                            to="/account/settings"
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Settings
                        </Link>
                        <Link 
                            to="/account/bookings" 
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Bookings & Payments
                        </Link>
                        <Link 
                            to="/account/notifications"
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Notifications
                        </Link>
                        <Link 
                            to="/account/sessions" 
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Signed-in Devices
                        </Link>
                        <Link 
                            to="/account/referrals" 
                            className="py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            Refer a friend
                        </Link>
                        <Link 
                            to="/policy" 
                            className="flex items-center gap-x-1.5 py-2 px-4 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-all w-52"
                            activeOptions={{ exact: true }}
                            activeProps={{ className: "py-2 px-4 rounded-md text-sm bg-gray-100 text-black! hover:bg-gray-100 font-medium" }}
                        >
                            <span>License & Policy</span>
                            <TbExternalLink className="size-4"/>
                        </Link>
                    </div>
                </div>
                <span className="text-gray-500 text-xs">© Hagz 2026.<br/>All rights reserved.</span>
            </div>
        </aside>
    )
}