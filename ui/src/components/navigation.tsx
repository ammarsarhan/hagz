"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Button from "@/components/button";
import { CreateModal } from "@/components/dashboard/modals";
import { useAuthContext } from "@/context/auth";
import { useDashboardContext } from "@/context/dashboard";

import { Menu, Plus, X, LogOut } from "lucide-react";
import { useState } from "react";

export function UserNavigation() {
    const path = usePathname();
    const { user, owner } = useAuthContext();
    
    const isActiveStyle = (match: string) => path === match ? "text-black hidden cursor-default" : "text-gray-500 hover:underline hidden";

    if (!owner) {
        return (
            <nav className="flex items-center justify-between p-5 relative">
                <div className="flex items-center gap-x-5">
                    <button>
                        <Menu className="w-5 h-5"/>
                    </button>
                    <Link href={"/"} className="lg:absolute lg:left-1/2 lg:top-1/2 lg:transform lg:-translate-x-1/2 lg:-translate-y-1/2">
                        <span className="font-semibold">Hagz</span>
                    </Link>
                </div>
                <div className="flex items-center gap-x-6 text-sm">
                    {
                        user && 
                            <>
                                <Link href={'/search'} className={`${isActiveStyle('/search')} [@media(min-width:450px)]:inline`}>Search</Link>
                                <Link href={'/featured'} className={`${isActiveStyle('/featured')} [@media(min-width:450px)]:inline`}>Featured</Link>
                                <Link href={'/faq'} className={`${isActiveStyle('/faq')} sm:inline`}>FAQs</Link>
                                <Link href={'/user/dashboard'} className="w-8 h-8 flex-center border-[1px] rounded-full text-gray-500 hover:border-gray-300! hover:text-black hover:bg-gray-50 transition-all ml-2">
                                    <span>{user.name.slice(0, 1)}</span>
                                </Link>
                            </>
                    }
                    {
                        !user && !owner &&
                        <>
                            <Link href={'/search'} className={`${isActiveStyle('/search')} [@media(min-width:450px)]:inline`}>Search</Link>
                            <Link href={'/featured'} className={`${isActiveStyle('/featured')} [@media(min-width:450px)]:inline`}>Featured</Link>
                            <Link href={'/faq'} className={`${isActiveStyle('/faq')} sm:inline`}>FAQs</Link>
                            <div className="ml-2 flex items-center gap-x-2">
                                <Link href={'/auth/user/sign-up'} className="hidden sm:inline">
                                    <Button variant="outline" className="text-xs rounded-sm">Sign Up</Button>
                                </Link>
                                <Link href={'/auth/user/sign-in'}>
                                    <Button className="text-xs rounded-sm">Log In</Button>
                                </Link>
                            </div>
                        </>
                    }
                </div>
            </nav>
        )
    }
}

export function OwnerNavigation({ open, setOpen } : { open: boolean, setOpen: (open: boolean) => void}) {
    const { owner } = useAuthContext();
    const { pitchIndex, groundIndex } = useDashboardContext();
    const path = usePathname();

    const [createOpen, setCreateOpen] = useState(false);

    const isActiveStyle = (match: string) => path === match ? "text-black cursor-default" : "text-gray-500 hover:underline";

    if (owner) {
        const pitch = owner.pitches[pitchIndex];
        const ground = `Ground ${groundIndex + 1}`;

        return (
            <>
                {
                    createOpen &&
                    <CreateModal close={() => setCreateOpen(false)}/>
                }
                <nav className={`w-full h-screen fixed top-0 left-0 bg-[#fafafa] md:w-72 md:static md:border-r-[1px] md:block ${open ? "" : "hidden"}`}>
                    <div className="flex flex-col h-screen justify-between p-6 md:p-5 text-sm [&_a]:w-fit [&_a]:hover:underline">
                        <div>
                            <div className="flex items-center justify-between gap-x-16">
                                <Link href={"/dashboard"}>
                                    <span className="font-semibold text-base text-black!">Hagz</span>
                                </Link>
                                <button onClick={() => setOpen(false)} className="md:hidden">
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>
                            {
                                pitch ?
                                <div className="mt-5 [&>span]:block">
                                    <span>{pitch.name}</span>
                                    <span>{ground}</span>
                                </div> :
                                <div className="mt-5">
                                    <button className="text-blue-800 text-underline flex items-center gap-x-1.5" onClick={() => setCreateOpen(true)}>
                                        <Plus className="w-4 h-4 text-blue-800"/>
                                        Create New Pitch
                                    </button>
                                </div>
                            }
                            <div className="flex flex-col gap-y-5 mt-6">
                                <Link href={"/dashboard/reservations"} className={isActiveStyle("/dashboard/reservations")}>Reservations</Link>
                                <Link href={"/dashboard/payments"} className={isActiveStyle("/dashboard/payments")}>Payments</Link>
                                <Link href={"/dashboard/analytics"} className={isActiveStyle("/dashboard/analytics")}>Analytics</Link>
                                <Link href={"/dashboard/pitch/grounds"} className={isActiveStyle("/dashboard/pitch/grounds")}>Manage Grounds</Link>
                                <Link href={"/dashboard/pitch/settings"} className={isActiveStyle("/dashboard/pitch/settings")}>Pitch Settings</Link>
                            </div>
                            <div className="flex flex-col gap-y-5 mt-6 pt-6 border-t-[1px]">
                                <Link href={"/account/settings"} className={isActiveStyle("/account/settings")}>Account Settings</Link>
                            </div>
                        </div>
                        <div>
                            <div className="flex flex-col gap-y-5">
                                <Link href={"/help"} className="text-gray-500 hover:underline">Help</Link>
                                <Link href={"/account/notifications"} className={isActiveStyle("/account/notifications")}>Notifications</Link>
                            </div>
                            <div className="flex flex-col gap-y-6 mt-5 md:mb-2 pt-6 border-t-[1px]">
                                <div className="flex items-center justify-between gap-x-8">
                                    <div className="flex items-center gap-x-3">
                                        <div className="flex-center rounded-full w-7 h-7 border-[1px]">
                                            {owner.name.slice(0, 1)}
                                        </div>
                                        <div className="[&>span]:block">
                                            <span>{owner.name}</span>
                                            <span className="text-gray-500">{ owner.company ? owner.company : "Individual" }</span>
                                        </div>
                                    </div>
                                    <Link href={"/auth/sign-out"}>
                                        <LogOut className="w-4 h-4 text-gray-500"/>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </nav>
            </>
        )
    }
}

export function AuthNavigation() {
    return (
        <nav className="absolute top-5 left-6 z-50">
            <Link href={"/"}>
                <span className="font-semibold">Hagz</span>
            </Link>
        </nav>
    )
}