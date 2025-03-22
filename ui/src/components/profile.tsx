import Link from "next/link";
import { useAuthContext } from "@/context/auth";
import { User, Bell, Book, CircleHelp, LogOut, File, ChevronDown, Settings } from "lucide-react";

export default function ProfileAvatar() {
    const { user, signOut } = useAuthContext();

    if (user) {
        return (
            <div className="group relative">
                <div className="flex items-center gap-x-1 cursor-pointer">
                    <Link className="flex-center rounded-full text-sm w-8 h-8 border-[1px]" href={"/user/profile"}>
                        {user.name.slice(0, 1)}
                    </Link>
                    <ChevronDown className="w-3 h-3"/>
                </div>
                <div className="absolute right-0 bottom-0 translate-y-[calc(100%+0.25rem)] w-48 flex flex-col rounded-md bg-white border-[1px] text-[0.825rem] invisible group-hover:visible">
                    <div className="flex flex-col border-b-[1px]">
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mt-1" href="/user/profile">
                            <User className="w-4 h-4"/>
                            <span>Profile</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1" href="/user/reservations">
                            <Book className="w-4 h-4"/>
                            <span>Reservations</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mt-1" href="/user/profile/settings">
                            <Settings className="w-4 h-4"/>
                            <span>Settings</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mb-1" href="/notifications">
                            <Bell className="w-4 h-4"/>
                            <span>Notifications</span>
                        </Link>
                    </div>
                    <div className="flex flex-col border-b-[1px]">
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mt-1" href="/guide">
                            <File className="w-4 h-4"/>
                            <span>Guide</span>
                        </Link>
                        <Link className="flex items-center gap-x-2 text-gray-700 px-4 py-2 hover:bg-gray-100 mx-1 mb-1" href="/help">
                            <CircleHelp className="w-4 h-4"/>
                            <span>Help center</span>
                        </Link>
                    </div>
                    <div className="flex flex-col border-b-[1px]">
                        <button className="flex items-center gap-x-2 text-red-700 px-4 py-2 hover:bg-gray-100 m-1" onClick={async () => await signOut()}>
                            <LogOut className="w-4 h-4"/>
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}