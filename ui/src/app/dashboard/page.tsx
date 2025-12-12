import Link from "next/link";

import Button from "@/app/components/base/Button";
import { fetchDashboard } from "@/app/utils/api/server";

import { LuGitPullRequestCreateArrow } from "react-icons/lu";
import { FaCircleInfo, FaCalculator, FaArrowRight } from "react-icons/fa6";
import { BiPlus } from "react-icons/bi";
import { QueryClient } from "@tanstack/react-query";
import { VscPreview } from "react-icons/vsc";
import { TbConfetti } from "react-icons/tb";

export default async function Home() {
    const queryClient = new QueryClient();

    const { user, pitches, stage } = await queryClient.fetchQuery({
        queryKey: ['dashboard', 'home'],
        queryFn: fetchDashboard
    });

    switch (stage) {
        case "NO_PITCH":
            return (
                <div className="h-full p-6">
                    <div className="w-full h-full flex items-center justify-center text-center">
                        <div className="max-w-108 flex flex-col gap-y-6 items-center justify-center">
                            <div className="flex flex-col gap-y-1.5">
                                <h1 className="text-xl font-semibold">Welcome, {user.firstName}</h1>
                                <span className="text-gray-600 text-[0.8125rem]">You do not have any pitches yet. To get started with Hagz we need a few details about your pitch.</span>
                            </div>
                            <div className="w-full flex items-center gap-x-4 p-4 border-[1px] border-gray-200 rounded-md">
                                <LuGitPullRequestCreateArrow className="size-7 flex-shrink-0 text-blue-800"/>
                                <div className="flex flex-col gap-y-0.5 text-left text-[0.8125rem]">
                                    <h3 className="font-medium">Create a pitch</h3>
                                    <p className="text-gray-600">Start and submit your pitch within 5 minutes.</p>
                                    <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline w-fit">
                                        <span>Go to builder</span>
                                    </Link>
                                </div>
                            </div>
                            <div className="flex items-center gap-x-4">
                                <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md">
                                    <FaCircleInfo className="size-7 flex-shrink-0 text-blue-800"/>
                                    <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                        <h3 className="font-medium">Read the documentation</h3>
                                        <p className="text-gray-600">Learn more about how Hagz can help you grow your business.</p>
                                        <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline w-fit">
                                            <span>Go to docs</span>
                                        </Link>
                                    </div>
                                </div>
                                <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md">
                                    <FaCalculator className="size-7 flex-shrink-0 text-blue-800"/>
                                    <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                        <h3 className="font-medium">Calculate pricing</h3>
                                        <p className="text-gray-600">Completely transparent pricing. View your potential cut.</p>
                                        <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline w-fit">
                                            <span>Go to calculator</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2">
                                <Link href="/dashboard/pitches/create"> 
                                    <Button className="gap-x-1.5 bg-black! border-gray-800! hover:border-gray-800! hover:bg-gray-800! text-white">
                                        <BiPlus className="size-3.5"/> 
                                        <span className="text-[0.8rem]">Create a pitch</span>
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            );
        case "PITCH_DRAFT":
            return (
                <div className="h-full p-6">
                    <div className="w-full h-full flex items-center justify-center text-center">
                        <div className="max-w-108 flex flex-col gap-y-6 items-center justify-center">
                            <div className="flex flex-col gap-y-1.5">
                                <h1 className="text-xl font-semibold">Welcome, {user.firstName}</h1>
                                <span className="text-gray-600 text-[0.8125rem]">You have a pitch draft in progress. To get started with Hagz, you need to complete your pitch details.</span>
                            </div>
                            <div className="w-full flex items-center gap-x-4 p-4 border-[1px] border-gray-200 rounded-md">
                                <LuGitPullRequestCreateArrow className="size-7 flex-shrink-0 text-blue-800"/>
                                <div className="flex flex-col gap-y-0.5 text-left text-[0.8125rem]">
                                    <h3 className="font-medium">Edit your pitch draft</h3>
                                    <p className="text-gray-600">Continue and finish your pitch within 3 minutes.</p>
                                    <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline">
                                        <span>Back to builder</span>
                                    </Link>
                                </div>
                            </div>
                            <div className="flex items-center gap-x-4">
                                <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md">
                                    <FaCircleInfo className="size-7 flex-shrink-0 text-blue-800"/>
                                    <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                        <h3 className="font-medium">Read the documentation</h3>
                                        <p className="text-gray-600">Learn more about how Hagz can help you grow your business.</p>
                                        <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline">
                                            <span>Go to docs</span>
                                        </Link>
                                    </div>
                                </div>
                                <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md">
                                    <FaCalculator className="size-7 flex-shrink-0 text-blue-800"/>
                                    <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                        <h3 className="font-medium">Calculate pricing</h3>
                                        <p className="text-gray-600">Completely transparent pricing. View your potential cut.</p>
                                        <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline">
                                            <span>Go to calculator</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2">
                                <Link href="/dashboard/pitches/create"> 
                                    <Button className="gap-x-2 bg-black! hover:bg-gray-800! border-0! text-white">
                                        <span className="text-[0.8rem]">Finish draft</span>
                                        <FaArrowRight className="size-3"/>
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            );
        case "PITCH_PENDING":
            return (
                <>
                    <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-y-8 py-4 mx-6">
                        <div className="flex flex-col items-center gap-y-2 text-center lg:w-3/4">
                            <VscPreview className="size-10 text-blue-700 mb-2"/>
                            <h1 className="text-xl font-medium">Your pitch has been submitted for review.</h1>
                            <p className="text-[0.8125rem] text-gray-500">Please wait while we process your pitch. A member of our team will get in touch with you. This process may take up to 48 hours. If you have any questions, feel free to <Link href="/help" className="text-blue-700 hover:underline transition-colors text-nowrap">contact us</Link>.</p>
                        </div>
                        <div className="flex items-center gap-x-4">
                            <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md w-80! h-full">
                                <FaCircleInfo className="size-7 flex-shrink-0 text-blue-800"/>
                                <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                    <h3 className="font-medium">Read the documentation</h3>
                                    <p className="text-gray-600">Learn more about how Hagz can help you grow your business.</p>
                                    <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline">
                                        <span>Go to docs</span>
                                    </Link>
                                </div>
                            </div>
                            <div className="w-full flex flex-col gap-y-4.5 p-4 border-[1px] border-gray-200 rounded-md w-80! h-full">
                                <FaCalculator className="size-7 flex-shrink-0 text-blue-800"/>
                                <div className="flex flex-col gap-y-1.5 text-left text-[0.8125rem]">
                                    <h3 className="font-medium">Calculate pricing</h3>
                                    <p className="text-gray-600">Completely transparent pricing. View your potential cut and earning growth.</p>
                                    <Link href="/dashboard/pitches/create" className="text-blue-800 flex items-center gap-x-1 hover:underline">
                                        <span>Go to calculator</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            );
        case "PUBLISHING_REQUIRED":
            {
                const id = pitches[0].id;

                return (
                    <>
                        <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-y-8 py-4 mx-6">
                            <div className="flex flex-col items-center gap-y-2 text-center lg:w-3/4">
                                <TbConfetti className="size-10 text-blue-700 mb-2"/>
                                <h1 className="text-xl font-medium">Congratulations! Your pitch has been approved.</h1>
                                <p className="text-[0.8125rem] text-gray-500">Your pitch details have been reviewed and approved by the Hagz quality assurance team. You may now go live to start accepting bookings.</p>
                                <div className="mt-4">
                                    <Link href={`/dashboard/pitch/${id}/settings`}> 
                                        <Button className="gap-x-2 bg-black! hover:bg-gray-800! border-0! text-white">
                                            <span className="text-[0.8rem]">Go to settings</span>
                                            <FaArrowRight className="size-2.75"/>
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </>
                );
            }
        case "INACTIVE":
            return (
                <div>
                    <span>All of your pitches are currently inactive. You need at least one pitch to view dashboard.</span>
                </div>
            )
        case "ACTIVE":
            return (
                <>
                </>
            )
    }
};