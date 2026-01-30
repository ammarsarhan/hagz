import Image from "next/image";

export default function AuthFormLayout({ children } : { children: React.ReactNode }) {
    return (
        <div className="h-screen lg:grid grid-cols-[1fr_1fr] xl:grid-cols-[3fr_3fr_1fr] grid-rows-1 gap-x-4 p-4">
            {children}
            <div className="hidden lg:block h-full rounded-md overflow-clip">
                <video className="h-full w-full object-cover select-none" playsInline autoPlay loop muted controls={false}>
                    <source src="/static/auth/primary.mp4#t=0.001"/>
                </video>
            </div>
            <div className="hidden xl:flex flex-col h-full bg-gray-50 rounded-md overflow-clip">
                <div className="h-1/2 relative">
                    <Image className="h-full w-full object-cover select-none" fill src={"/static/auth/tertiary.jpg"} alt=""/>
                </div>
                <video className="h-1/2 w-full object-cover select-none" playsInline autoPlay loop muted controls={false}>
                    <source src="/static/auth/secondary.mp4#t=0.001"/>
                </video>
            </div>
        </div>
    )
};
