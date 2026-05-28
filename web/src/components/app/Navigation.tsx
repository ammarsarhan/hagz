import { Link } from "@tanstack/react-router";
import { TbBallFootball, TbChevronDown } from "react-icons/tb";
import Button from "@/components/shared/Button";

export default function Navigation() {
    return (
        <nav className="flex flex-col gap-y-4 pb-4 border-b border-gray-100">
            <div className="h-2 bg-primary"></div>
            <div className="flex items-center justify-between px-6">
                <div className="flex-center size-10 rounded-md bg-primary">
                    <TbBallFootball className="size-6.5" strokeWidth={2}/>
                </div>
                <div className="flex items-center gap-x-8">
                    <div className="flex items-center gap-x-6">
                        <Link to={"/"}>
                            <span className="font-semibold">Home</span>
                        </Link>
                        <Link to={"/"}>
                            <span className="">Explore</span>
                        </Link>
                        <Link to="/" className="flex items-center gap-x-1.5">
                            <span>How it works</span>
                            <TbChevronDown className="size-4" />
                        </Link>
                        <Link to={"/"}>
                            <span className="">Contact</span>
                        </Link>
                        <Link to={"/"}>
                            <span className="">Own a pitch?</span>
                        </Link>
                    </div>
                    <div className="flex items-center gap-x-3">   
                        <Link to="/auth/sign-in">
                            <Button className="bg-primary hover:bg-primary/85">
                                <span className="font-medium">Log In</span>
                            </Button>
                        </Link>
                        <Link to="/auth/sign-up">
                            <Button className="border-gray-200! hover:bg-gray-50">
                                <span className="font-medium">Sign Up</span>
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}