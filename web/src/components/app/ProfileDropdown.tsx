import { client } from "#/lib/client";
import type User from "#/lib/types/user";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TbBell, TbLoader, TbLogout, TbSettings, TbUser } from "react-icons/tb";

export default function ProfileDropdown({ user, onClose } : { user: User, onClose: () => void }) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const signOut = async () => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            await client.auth["sign-out"].$post();
            onClose();
            navigate({ to: "/" });
        } catch (err) {
            setIsLoading(false);
        }
    }

    return (
        <div className="text-sm p-1 flex flex-col absolute top-full right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-50">
            <Link
                to="/account"
                onClick={onClose}
                className="flex items-center gap-x-2 px-2 py-2 hover:bg-gray-50 transition-all"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-gray-100 hover:bg-gray-100" }}
            >
                <TbUser className="text-gray-500 size-4"/>
                <div className="flex flex-col">
                    <span className="">Profile</span>
                    <span className="text-gray-500 text-[0.8125rem] -mt-0.5">{user.firstName} {user.lastName}</span>
                </div>
            </Link>
            <Link
                to="/account/settings"
                onClick={onClose}
                className="flex items-center gap-x-2 px-2 py-2 hover:bg-gray-50 transition-all"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-gray-100 hover:bg-gray-100" }}
            >
                <TbSettings className="text-gray-500 size-4"/>
                <span className="">Settings</span>
            </Link>
            <Link
                to="/account/notifications"
                onClick={onClose}
                className="flex items-center gap-x-2 px-2 py-2 hover:bg-gray-50 transition-all"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-gray-100 hover:bg-gray-100" }}
            >
                <TbBell className="text-gray-500 size-4"/>
                <span className="">Notifications</span>
            </Link>
            <button
                onClick={signOut}
                className={`flex items-center gap-x-2 px-2 py-2 transition-all ${isLoading ? "text-gray-500 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"}`}
            >
                {
                    isLoading ?
                    <TbLoader className="text-gray-500 size-4 animate-spin"/> :
                    <TbLogout className="text-gray-500 size-4"/>
                }
                <span>Sign out</span>
            </button>
        </div>
    );
}