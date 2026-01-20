"use client";

import Image from "next/image";

export default function AuthFormLayout({ children } : { children: React.ReactNode }) {
    return (
        <div className="h-screen grid grid-cols-[3fr_3fr_1fr] grid-rows-1 gap-x-4 p-4">
            <div className="h-full rounded-md">
                {children}
            </div>
            <div className="h-full rounded-md overflow-clip">
                <video className="h-full w-full object-cover select-none" autoPlay loop muted controls={false}>
                    <source src="/static/auth/primary.mp4"/>
                </video>
            </div>
            <div className="flex flex-col h-full bg-black rounded-md overflow-clip">
                <div className="h-1/2 relative">
                    <Image className="h-full w-full object-cover select-none" fill src={"/static/auth/tertiary.jpg"} alt=""/>
                </div>
                <video className="h-1/2 w-full object-cover select-none" autoPlay loop muted controls={false}>
                    <source src="/static/auth/secondary.mp4"/>
                </video>
            </div>
        </div>
    )
}