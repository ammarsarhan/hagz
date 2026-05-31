import { Link } from "@tanstack/react-router";

export default function ProfileAside() {
    return (
        <aside className="px-4 py-10 h-full">
            <h1 className="font-medium text-lg mb-4">Profile</h1>
            <div className="flex flex-col gap-y-1 text-nowrap">
                <Link 
                    to="/profile" 
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    General
                </Link>
                <Link 
                    to="/profile/settings"
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    Preferences
                </Link>
                <Link 
                    to="/profile/history" 
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    Bookings & Payments
                </Link>
                <Link 
                    to="/profile/notifications"
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    Notifications
                </Link>
                <Link 
                    to="/profile/sessions" 
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    Signed-in Devices
                </Link>
                <Link 
                    to="/profile/referrals" 
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    Refer a friend
                </Link>
                <Link 
                    to="/policy" 
                    className="py-2 pl-4 pr-12 rounded-md text-base text-gray-500"
                    activeOptions={{ exact: true }}
                    activeProps={{ className: "py-2 pl-4 pr-12 rounded-md text-base bg-gray-100 text-black!" }}
                >
                    License & Policy
                </Link>
            </div>
        </aside>
    )
}