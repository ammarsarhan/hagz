"use client";

import { ReactNode } from "react";
import { useSelectedLayoutSegments } from "next/navigation";
import Link from "next/link";

import { IoMdArrowBack } from "react-icons/io";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPitchState } from "@/app/utils/api/client";

const Header = ({ id, isDisabled } : { id : string, isDisabled: boolean }) => {
    const segments = useSelectedLayoutSegments();
    const prefix = `/dashboard/pitch/${id}`;

    const key = segments.find(s => s !== "(protected)") ?? "overview";
    const isHidden = ["bookings", "payments", "analytics"].includes(key);

    const paths = [
        {
            key: "overview",
            href: "/",
            title: "Overview",
            description: "View your pitch details, recent bookings, analytics, payments, and suggestions.",
            disabled: false
        },
        {
            key: "settings",
            href: "/settings",
            title: "Settings",
            description: "Manage your pitch settings and create invitations to add managers.",
            disabled: false
        },
        {
            key: "bookings",
            href: "/bookings/all",
            title: "Bookings",
            description: "Create, manage, and filter bookings for your pitch.",
            disabled: isDisabled
        },
        {
            key: "payments",
            href: "/payments",
            title: "Payments",
            description: "Handle and view your payment history and next scheduled payment.",
            disabled: isDisabled
        },
        {
            key: "analytics",
            href: "/analytics",
            title: "Analytics",
            description: "Observe how your pitch is performing and get improvement suggestions.",
            disabled: isDisabled
        },
    ];

    const { title, description } = paths.find(item => item.key === key)!;

    if (isHidden) {
        return (
            <header className="flex flex-col gap-y-4 mt-6 mx-6">
                <Link className="flex items-center gap-x-1 text-blue-700 hover:underline w-fit" href="/dashboard/pitches">
                    <IoMdArrowBack className="size-3.5"/>
                    <span className="text-[0.8125rem]">View all pitches</span>
                </Link>
                <div className="flex flex-col gap-y-0.5">
                    <h1 className="text-lg font-semibold">{title}</h1>
                    <p className="text-gray-500 text-[0.8125rem]">{description}</p>
                </div>
            </header>
        )
    };

    return (
        <header className="flex flex-col gap-y-4 mt-6 mx-6">
            <Link className="flex items-center gap-x-1 text-blue-700 hover:underline w-fit" href="/dashboard/pitches">
                <IoMdArrowBack className="size-3.5"/>
                <span className="text-[0.8125rem]">View all pitches</span>
            </Link>
            <div className="flex flex-col gap-y-0.5">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-gray-500 text-[0.8125rem]">{description}</p>
            </div>
            <div className="flex items-center gap-x-4 border-y-[1px] border-gray-200 text-[0.8125rem] mt-1">
                {
                    paths.map(item => {
                        const isActive = item.key === key;
                        const href = prefix + item.href;

                        if (item.disabled) {
                            return <span className="px-4 py-2.5 text-gray-300 cursor-not-allowed" key={item.key}>{item.title}</span>
                        };

                        if (isActive) {
                            return <Link className="px-4 py-2.5 border-b-[1px] border-blue-700 text-blue-700" key={item.key} href={href}>{item.title}</Link>
                        }

                        return (
                            <Link className="px-4 py-2.5 text-gray-600 hover:text-black transition-colors" key={item.key} href={href}>{item.title}</Link>
                        )
                    })
                }
            </div>
        </header>
    )
}

export default function PitchShell({ children, id } : { children: ReactNode, id: string }) {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ['dashboard', 'pitch', id],
        queryFn: () => fetchPitchState(id),
        initialData: () => queryClient.getQueryData(['dashboard', 'pitch', id])
    });

    if (!data) return (
        <div className="flex flex-col items-center justify-center gap-y-1.5 text-center w-full h-full">
            <h1 className="font-medium text-lg">Could Not Find Pitch</h1>
            <div className="text-[0.8125rem] text-gray-500">
                <p>Could not find a pitch with the specified ID. Please make sure the resource you are trying to access is available and try again.</p>
            </div>
            <Link className="text-blue-700 hover:underline w-fit mt-1" href="/dashboard/pitches">
                <span className="text-[0.8125rem]">View all pitches</span>
            </Link>
        </div>
    );

    const status = data.status;
    const isDisabled = status === "APPROVED";

    return (
        <>
            <Header id={id} isDisabled={isDisabled}/>
            {children}
        </>
    )
}