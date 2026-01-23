"use client";

import Link from "next/link";

import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";

import { FaChevronDown, FaChevronRight, FaUser } from "react-icons/fa6";
import useAuthContext from "@/app/context/Auth";

export default function Navigation() {
    const { user } = useAuthContext();

    return (
        <nav className="h-18 flex items-center justify-between py-4 px-6 text-[0.85rem] font-medium">
            <div className="flex items-center gap-x-5">
                <Link href="/">
                    <Logo active/>
                </Link>
                <div className="flex items-center gap-x-5">
                    <Link href="/" className="hover:underline">Search</Link>
                    <Link href="/" className="hover:underline">How It Works</Link>
                    <Link href="/" className="hover:underline">Policy</Link>
                    <Link href="/" className="hover:underline">Contact</Link>
                    <Link href="/" className="hover:underline">FAQs</Link>
                </div>
            </div>
            {
                user ?
                <div className="flex items-center gap-x-4">
                    <Link href="/profile" className="flex items-center gap-x-2.5">
                        <div className="size-8 flex-center bg-slate-200 rounded-full">
                            <FaUser className="size-4 text-slate-400"/>
                        </div>
                        <div className="flex flex-col text-xs">
                            <span className="font-medium">{user.firstName} {user.lastName}</span>
                            <span className="text-gray-500">{user.phone}</span>
                        </div>
                        <FaChevronDown className="size-3 text-gray-500"/>
                    </Link>
                </div> :
                <div className="flex items-center gap-x-4">
                    <Link href="/" className="hover:underline mx-1">Have a pitch?</Link>
                    <div className="flex items-center gap-x-2">
                        <Link href="/auth/sign-in">
                            <Button variant="outline">Sign In</Button>
                        </Link>
                        <Link href="/auth/sign-up">
                            <Button variant="primary">
                                <span className="group-hover:text-black/75">Create An Account</span>
                                <FaChevronRight className="size-3 group-hover:-rotate-45 group-hover:text-black/75 transition-all" />
                            </Button>
                        </Link>
                    </div>
                </div>
            }
        </nav>
    )
}