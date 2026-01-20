import Button from "@/app/components/base/Button";
import Link from "next/link";
import { FaArrowRight, FaPeopleArrows, FaPerson } from "react-icons/fa6";

export default function SignUp() {
    return (
        <div className="w-full">
            <h1 className="font-semibold text-3xl w-full">Are you an individual <br/> or an owner?</h1>
            <p className="text-gray-500 text-sm mt-2">Selecting the proper role will help us personalize your experience to get the best out of Hagz.</p>
            <div className="flex flex-col gap-y-4 my-10">
                <button className="bg-gray-100 hover:bg-gray-100/75 transition-colors flex-center gap-x-4 p-4 rounded-md border border-black/10 hover:border-black/20 cursor-pointer">
                    <FaPerson className="size-8"/>
                    <div className="flex-1 flex flex-col text-left">
                        <span className="font-medium text-sm">I am an individual</span>
                        <p className="text-gray-600 text-xxs">I am looking to book pitches for me and my friends. I want to explore pitches and find the closest/cheapest to me.</p>
                    </div>
                    <div className="size-4.5 rounded-full border border-black/30">

                    </div>
                </button>
                <button className="bg-gray-100 hover:bg-gray-100/75 transition-colors flex-center gap-x-4 p-4 rounded-md border border-black/10 hover:border-black/20 cursor-pointer">
                    <FaPeopleArrows className="size-8"/>
                    <div className="flex-1 flex flex-col text-left">
                        <span className="font-medium text-sm">I am a pitch owner</span>
                        <p className="text-gray-600 text-xxs">I am looking to manage my pitch, add team members, and gain exposure to a bigger client base.</p>
                    </div>
                    <div className="size-4.5 rounded-full border border-black/30">

                    </div>
                </button>
            </div>
            <div className="w-full flex-center">
                <Link href="/auth/sign-up/user">
                    <Button variant="mono">
                        <span className="text-sm">Continue</span>
                        <FaArrowRight className="size-3" />
                    </Button>
                </Link>
            </div>
        </div>
    )
}