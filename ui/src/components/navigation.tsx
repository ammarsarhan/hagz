"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import Button from "@/components/button";
import { useAuthContext } from "@/context/auth";

import { Menu } from "lucide-react";

export function UserNavigation() {
    const path = usePathname();
    const { user, owner } = useAuthContext();
    
    const isActiveStyle = (pathname: string) => path === pathname ? "text-black hidden cursor-default" : "text-gray-500 hover:underline hidden";

    return (
        <nav className="flex items-center justify-between p-6 relative">
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
                    user ? 
                        <>
                            <Link href={'/search'} className={`${isActiveStyle('/search')} [@media(min-width:450px)]:inline`}>Search</Link>
                            <Link href={'/featured'} className={`${isActiveStyle('/featured')} [@media(min-width:450px)]:inline`}>Featured</Link>
                            <Link href={'/faq'} className={`${isActiveStyle('/faq')} sm:inline`}>FAQs</Link>
                            <Link href={'/user/dashboard'} className="w-8 h-8 flex-center border-[1px] rounded-full text-gray-500 hover:border-gray-300! hover:text-black hover:bg-gray-50 transition-all ml-2">
                                <span>{user.name.slice(0, 1)}</span>
                            </Link>
                        </>
                    :
                    owner ?
                        <Link href={'/owner/dashboard'} className="text-gray-500 hover:underline">Your Dashboard</Link> 
                    :
                        <>
                            <Link href={'/search'} className={`${isActiveStyle('/search')} [@media(min-width:450px)]:inline`}>Search</Link>
                            <Link href={'/featured'} className={`${isActiveStyle('/featured')} [@media(min-width:450px)]:inline`}>Featured</Link>
                            <Link href={'/faq'} className={`${isActiveStyle('/faq')} sm:inline`}>FAQs</Link>
                            <div className="ml-2 flex items-center gap-x-2">
                                <Link href={'/auth/user/sign-up'} className="hidden sm:inline">
                                    <Button variant="outline" className="text-xs rounded-sm">Sign Up</Button>
                                </Link>
                                <Link href={'/auth/user/log-in'}>
                                    <Button className="text-xs rounded-sm">Log In</Button>
                                </Link>
                            </div>
                        </>
                }
            </div>
        </nav>
    )
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