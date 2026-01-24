import Link from "next/link";
import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";

export default function ErrorView({ icon, title, message, action, href, error } : { icon: React.ReactNode, title: string, message: string, action?: string, href?: string, error: string }) {
    return (
        <div className="relative w-screen h-screen flex-center flex-col gap-y-4 p-4">
            <Link href="/" className="absolute top-4 left-4">
                <Logo/>
            </Link>
            {icon}
            <div className="flex flex-col gap-y-1.5 max-w-xl text-center mt-4">
                <h1 className="font-semibold text-xl">{title}</h1>
                <p className="text-gray-700 text-xxs">{message}</p>
            </div>
            {
                href && action &&
                <Link href={href} className="mt-4">
                    <Button>
                        <span className="font-medium">{action}</span>
                    </Button>
                </Link>
            }
            <span className="absolute text-xxs bottom-4 left-1/2 -translate-x-1/2 text-gray-700">
                {error}
            </span>
        </div>
    )
}