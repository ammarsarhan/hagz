import Image from "next/image"
import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa6"

export default function AuthFormLayout({ children } : { children: React.ReactNode }) {
    return (
        <div className="h-screen grid grid-cols-[3fr_3fr_1fr] grid-rows-1 gap-x-4 p-4">
            <div className="h-full bg-gray-200 rounded-md">
                <div className="h-full relative flex-center flex-col p-10">
                    <div className="absolute top-5 left-5">
                        <Link href="/" className="flex items-center gap-x-1.5 text-secondary hover:text-secondary/75 transition-all">
                            <FaArrowLeft className="size-3"/>
                            <span className="font-medium text-sm ">Back to home</span>
                        </Link>
                    </div>
                    {children}
                    <span className="absolute bottom-6 right-6 text-gray-600 text-xs">© Hagz 2026</span>
                </div>
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