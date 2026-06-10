import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TbBallFootball, TbBell, TbChevronDown, TbHistory, TbLayoutDashboard } from "react-icons/tb";
import type User from "#/lib/types/user";
import Button from "#/components/shared/Button";
import Avatar from "#/components/shared/Avatar";
import ProfileDropdown from "#/components/app/ProfileDropdown";

export default function Navigation({ user } : { user: User | null }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const isOwner = user && user.preferences.role === "OWNER";

    return (
        <nav className="flex flex-col gap-y-4 pb-4 border-b border-gray-100 text-base fixed top-0 w-full bg-white z-99">
            <div className="h-2 bg-primary"></div>
            <div className="flex items-center justify-between px-6">
                <Link to="/">
                    <div className="flex-center size-10 rounded-md bg-primary">
                        <TbBallFootball className="size-6.5" strokeWidth={2}/>
                    </div>
                </Link>
                <div className="flex items-center gap-x-8">
                    <div className="flex items-center gap-x-6">
                        <Link 
                            to={"/"}
                            activeProps={{ className: "font-semibold hover:text-black!" }}
                            inactiveProps={{ className: "font-normal" }}
                            className="hover:text-gray-700 transition-colors"
                        >
                            <span>Home</span>
                        </Link>
                        <Link 
                            to={"/pitches/explore"}
                            activeProps={{ className: "font-semibold hover:text-black!" }}
                            inactiveProps={{ className: "font-normal" }}
                            className="hover:text-gray-700 transition-colors"
                        >
                            <span>Explore</span>
                        </Link>
                        <button 
                            className="flex items-center gap-x-1.25 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                            <span>How it works</span>
                            <TbChevronDown className="size-4" />
                        </button>
                        <Link 
                            to={"/contact"}
                            activeProps={{ className: "font-semibold hover:text-black!" }}
                            inactiveProps={{ className: "font-normal" }}
                            className="hover:text-gray-700 transition-colors"
                        >
                            <span>Contact</span>
                        </Link>
                    </div>
                    {
                        user ?
                        <div className="flex items-center gap-x-3">
                            {
                                isOwner ?
                                <Link to={`/dashboard`}>
                                    <div className="flex items-center gap-x-2 py-1.5 pl-1.5 pr-3 bg-black hover:bg-black/75 transition-colors rounded-full">
                                        <div className="size-6 bg-primary flex-center rounded-full">
                                            <TbLayoutDashboard strokeWidth={2.5}/>
                                        </div>
                                        <span className="text-white text-[0.8125rem]">Dashboard</span>
                                    </div>
                                </Link> :
                                <>
                                    <Link to={"/account/bookings"}>
                                        <div className="size-9 flex-center rounded-md border border-transparent bg-black hover:bg-black/75 cursor-pointer transition-colors">
                                            <TbHistory size={16} className="text-white"/> 
                                        </div>
                                    </Link>
                                    <Link to={"/account/notifications"}>
                                        <div className="size-9 flex-center rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                                            <TbBell size={16}/> 
                                        </div>
                                    </Link>
                                </>
                            }
                            <div className="relative" ref={dropdownRef}>
                                <Avatar onClick={() => setIsOpen(v => !v)} className={`${isOpen ? "border-black!" : "border-gray-200"} cursor-pointer`} label={user.firstName[0].toUpperCase()}/>
                                {
                                    isOpen &&
                                    <ProfileDropdown user={user} onClose={() => setIsOpen(false)}/>    
                                }
                            </div>
                        </div> :
                        <div className="flex items-center gap-x-3">   
                            <Link to="/auth/sign-in">
                                <Button className="bg-primary hover:bg-primary/85">
                                    <span className="font-medium">Log In</span>
                                </Button>
                            </Link>
                            <Link to="/auth/sign-up">
                                <Button className="border-gray-200! hover:bg-gray-50">
                                    <span className="font-medium">Sign Up</span>
                                </Button>
                            </Link>
                        </div>
                    }
                </div>
            </div>
        </nav>
    )
}