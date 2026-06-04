import { Link } from "@tanstack/react-router";
import { TbBallFootball, TbBell, TbSettings } from "react-icons/tb";
import Button from "#/components/shared/Button";
import type User from "#/lib/types/user";
import Avatar from "#/components/shared/Avatar";

export default function Navigation({ user } : { user: User | null }) {
    const isOwner = (user && user.pitches.length > 0);

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
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span>Home</span>
                        </Link>
                        <Link 
                            to={"/pitches/search"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">Explore</span>
                        </Link>
                        <Link 
                            to={isOwner ? "/product/owners" : "/product/users"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">How it works</span>
                        </Link>
                        <Link 
                            to={"/contact"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">Contact</span>
                        </Link>
                        {
                            isOwner &&
                            <Link to={`/dashboard/pitches/$pitchId`} params={{ pitchId: user.pitches[0].pitchId }}>
                                <Button className="bg-primary hover:bg-primary/85">
                                    <span className="font-medium">Dashboard</span>
                                </Button>
                            </Link>
                        }
                        {
                            !user &&
                            <Link 
                                to={"/owners"}
                                activeProps={{ className: "font-semibold" }}
                                inactiveProps={{ className: "font-normal" }}
                            >
                                <span>Own a pitch?</span>
                            </Link>
                        }
                    </div>
                    {
                        user ?
                        <div className="flex items-center gap-x-3">
                            <Link to={"/account/settings"}>
                                <div className="size-9 flex-center rounded-md border border-transparent bg-black hover:bg-black/75 cursor-pointer transition-colors">
                                    <TbSettings size={16} className="text-white"/> 
                                </div>
                            </Link>
                            <Link to={"/account/notifications"}>
                                <div className="size-9 flex-center rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                                    <TbBell size={16}/> 
                                </div>
                            </Link>
                            <Link to={"/account"}>
                                <Avatar className="hover:bg-gray-100" label={user.firstName[0].toUpperCase()}/>
                            </Link>
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