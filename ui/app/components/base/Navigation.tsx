import Link from "next/link";

import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";
import { User } from "@/app/utils/types/user";

import { FaChevronRight } from "react-icons/fa6";

export default async function Navigation({ user } : { user: User | null }) {
    return (
        <nav className="h-18 flex items-center justify-between py-4 px-6 text-[0.85rem] font-medium">
            <div className="flex items-center gap-x-5">
                <Link href="/">
                    <Logo active/>
                </Link>
                <div className="hidden lg:flex items-center gap-x-5">
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
                    
                </div> :
                <div className="hidden lg:flex items-center gap-x-4">
                    <Link href="/auth/sign-up/owner" className="hover:underline text-secondary hover:text-secondary/75 transition-colors mx-1">Have a pitch?</Link>
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