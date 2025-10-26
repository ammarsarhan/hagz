"use client";

import { useState } from "react";
import Link from "next/link";

import Button from "@/app/components/base/Button";
import { PathLink } from "@/app/components/base/PathLink";

import { FaPerson } from "react-icons/fa6";
import { FaPeopleCarry } from "react-icons/fa";

export default function SignUp() {
    const [isSelected, setIsSelected] = useState(0);

    const options = [
        {
            icon: <FaPerson className="size-6"/>,
            title: "I am an individual",
            description: "Create bookings as an individual user.",
            href: "/auth/user/sign-up"
        },
        {
            icon: <FaPeopleCarry className="size-6"/>,
            title: "I am a pitch owner",
            description: "Manage, view, and create bookings for my pitch.",
            href: "/auth/owner/sign-up"
        }
    ];

    return (
        <div className="lg:grid grid-cols-2 h-screen p-4">
            <div className="bg-black rounded-xl">
            </div>
            <div className="relative h-full text-sm">
                <div className="flex items-center justify-between h-full w-full">
                    <div className="flex flex-col items-center justify-center w-full gap-y-6">
                        <div className="flex flex-col gap-y-1 text-center">
                            <h1 className="text-xl font-semibold">Sign Up To Hagz</h1>
                            <span className="text-gray-600 text-[0.8125rem]">Create a new account to start creating and managing your bookings.</span>
                        </div>
                        <div className="flex flex-col gap-y-4">
                            {
                                options.map((option, index) => (
                                    <PathLink key={index} icon={option.icon} isSelected={isSelected == index} title={option.title} description={option.description} className="w-80 text-[0.8125rem]" onClick={() => setIsSelected(index)}/>
                                ))
                            }
                        </div>
                        <Link href={options[isSelected].href} >
                            <Button className="w-40 mx-auto text-white bg-black! hover:bg-gray-900! border-black! [@media(max-height:700px)]:my-4">
                                <span className="block w-full text-center text-[0.8125rem]">Continue</span>
                            </Button>
                        </Link>
                    </div>
                </div>
                <div className="absolute bottom-4 w-full text-center text-[0.8125rem]">
                    <span className="text-gray-600">Already have an account? <Link href="/auth/sign-in" className="text-blue-700 hover:underline">Sign in</Link></span>
                </div>
            </div>
        </div>
    )
}