import { Link } from "@tanstack/react-router";
import { TbBallFootball, TbChevronDown } from "react-icons/tb";
import Button from "@/components/shared/Button";

export default function Navigation() {
    return (
        <nav className="flex flex-col gap-y-4 pb-4 border-b border-gray-100 text-base fixed top-0 w-full bg-white z-99">
            <div className="h-2 bg-primary"></div>
            <div className="flex items-center justify-between px-6">
                <div className="flex-center size-10 rounded-md bg-primary">
                    <TbBallFootball className="size-6.5" strokeWidth={2}/>
                </div>
                <div className="flex items-center gap-x-8">
                    <div className="flex items-center gap-x-6">
                        <Link 
                            to={"/"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span>Home</span>
                        </Link>
                        <Link 
                            to={"/pitches/search"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">Explore</span>
                        </Link>
                        <Link 
                            to={"/how-it-works"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">How it works</span>
                        </Link>
                        <Link 
                            to={"/contact"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
                            <span className="">Contact</span>
                        </Link>
                        <Link 
                            to={"/owners"}
                            activeProps={{ className: "font-semibold" }}
                            inactiveProps={{ className: "font-normal" }}
                        >
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