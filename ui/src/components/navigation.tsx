"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/context/auth";
import Button from "@/components/button";
import Banner from "@/components/banner";
import ProfileAvatar from "@/components/profile";

export function UserNavigation() {
    const path = usePathname();
    const { user } = useAuthContext();
    const getLinkStyle = (link: string) => path == link ? "text-gray-900" : "text-gray-500";

    return (
        <>
            {
                user?.status == "UNVERIFIED" &&
                <Banner>
                    <span>You have not verified your account yet. Please <Link href={"/profile/verify"} className="text-blue-800 underline">verify</Link> your account to start reserving!</span>
                </Banner>
            }
            <nav className="px-6 py-4 flex items-center justify-between">
                <div>
                    <Link href={"/"}>
                        <span className="font-semibold">Hagz</span>
                    </Link>
                </div>
                <div className="flex items-center gap-x-8 text-sm absolute left-1/2 -translate-x-1/2">
                    <Link href={"/"} className={getLinkStyle("/")}>Home</Link>
                    <Link href={"/featured"} className={getLinkStyle("/featured")}>Featured</Link>
                    <Link href={"/search"} className={getLinkStyle("/search")}>Search</Link>
                    <Link href={"/policy"} className={getLinkStyle("/policy")}>Policy</Link>
                    <Link href={"/faq"} className={getLinkStyle("/faq")}>FAQs</Link>
                </div>
                {
                    user ? <ProfileAvatar/> :
                    <>
                        <div className="flex items-center gap-x-4">
                            <Link href={"/auth/user/log-in"} className="text-xs">
                                <Button variant="primary">
                                    Log In
                                </Button>
                            </Link>
                            <Link href={"/auth/user/sign-up"} className="text-xs">
                                <Button variant="outline">
                                    Sign Up
                                </Button>
                            </Link>
                        </div>
                    </>
                }
            </nav>
        </>
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