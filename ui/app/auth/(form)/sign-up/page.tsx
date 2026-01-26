"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";
import { FaArrowLeft, FaArrowRight, FaCheck, FaPeopleArrows, FaPerson } from "react-icons/fa6";
import { motion } from "framer-motion";

export default function SignUp() {
    const [isUser, setIsUser] = useState(true);
    const path = isUser ? "user" : "owner";

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full relative flex-center flex-col p-10"
        >
            <div className="absolute top-4 left-4">
                <Link href="/" className="flex items-center gap-x-1.5 text-secondary hover:text-secondary/75 transition-all">
                    <FaArrowLeft className="size-3"/>
                    <span className="font-medium text-sm ">Back to home</span>
                </Link>
            </div>
            <div className="w-full">
                <Logo/>
                <h1 className="font-semibold text-3xl w-full mt-4">Are you an individual <br/> or an owner?</h1>
                <p className="text-gray-500 text-sm mt-2">Selecting the proper role will help us personalize your experience to get the best out of Hagz.</p>
                <div className="flex flex-col gap-y-4 my-10">
                    <button onClick={() => setIsUser(true)} className={`transition-colors flex-center gap-x-4 p-4 rounded-md border ${isUser ? "border-secondary bg-secondary/5" : "hover:bg-gray-50 border-black/10 hover:border-black/20"}`}>
                        <FaPerson className="size-8"/>
                        <div className="flex-1 flex flex-col text-left">
                            <span className="font-medium text-sm">I am an individual</span>
                            <p className="text-gray-600 text-xxs">I am looking to book pitches for me and my friends. I want to explore pitches and find the closest/cheapest to me.</p>
                        </div>
                        <div className={`size-5 flex-center rounded-full border ${isUser ? "bg-secondary border-secondary" : "bg-transparent border-black/30"}`}>
                            {
                                isUser &&
                                <FaCheck className="size-3 text-white"/>
                            }
                        </div>
                    </button>
                    <button onClick={() => setIsUser(false)} className={`transition-colors flex-center gap-x-4 p-4 rounded-md border ${!isUser ? "border-secondary bg-secondary/5" : "hover:bg-gray-50 border-black/10 hover:border-black/20"}`}>
                        <FaPeopleArrows className="size-8"/>
                        <div className="flex-1 flex flex-col text-left">
                            <span className="font-medium text-sm">I am a pitch owner</span>
                            <p className="text-gray-600 text-xxs">I am looking to manage my pitch, add team members, and gain exposure to a bigger client base.</p>
                        </div>
                        <div className={`size-5 flex-center rounded-full border ${!isUser ? "bg-secondary border-secondary" : "bg-transparent border-black/30"}`}>
                            {
                                !isUser &&
                                <FaCheck className="size-3 text-white"/>
                            }
                        </div>
                    </button>
                </div>
                <div className="w-full flex-center">
                    <Link href={`/auth/sign-up/${path}`} prefetch>
                        <Button variant="primary">
                            <span className="text-xxs font-medium">Continue</span>
                            <FaArrowRight className="size-3 group-hover:-rotate-45 transition-all" />
                        </Button>
                    </Link>
                </div>
            </div>
            <span className="absolute bottom-6 right-6 text-gray-600 text-xs">© Hagz 2026</span>
        </motion.div>
    )
}