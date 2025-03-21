import Link from "next/link";
import { useAuthContext } from "@/context/auth";
import { User, Bell, Book, CircleHelp, LogOut } from "lucide-react";

export default function ProfileAvatar() {
    const { user, signOut } = useAuthContext();

    if (user) {
        return (
            <div className="group relative">
                <div className="flex-center rounded-full text-sm w-8 h-8 border-[1px] cursor-pointer mb-1">
                    {user.name.slice(0, 1)}
                </div>
                <div className="absolute right-0 w-48 flex flex-col rounded-md bg-white border-[1px] text-[0.825rem] invisible group-hover:visible">
                    <div className="flex flex-col border-b-[1px]">
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mt-1" href="/profile">
                            <User className="w-4 h-4"/>
                            <span>Profile</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1" href="/profile/reservations">
                            <Book className="w-4 h-4"/>
                            <span>Reservations</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mb-1" href="/notifications">
                            <Bell className="w-4 h-4"/>
                            <span>Notifications</span>
                        </Link>
                    </div>
                    <div className="flex flex-col border-b-[1px]">
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 m-1" href="/notifications">
                            <CircleHelp className="w-4 h-4"/>
                            <span>Guide</span>
                        </Link>
                    </div>
                    <div className="flex flex-col border-b-[1px]">
                        <button className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 m-1" onClick={async () => await signOut()}>
                            <LogOut className="w-4 h-4"/>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}