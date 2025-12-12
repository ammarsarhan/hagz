"use client";

import Link from "next/link";
import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPitchState } from "@/app/utils/api/client";
import { IoMdArrowBack } from "react-icons/io";

const Header = ({ id, isDisabled }: { id: string; isDisabled: boolean }) => {
    const pathname = usePathname();

    const prefix = `/dashboard/pitch/${id}`;
    const cleanPath = pathname.replace(/^\/dashboard\/pitch\/[^/]+\/?/, "");
    const key = cleanPath || "overview";

    const paths = useMemo(() => [
        {
            key: "overview",
            href: "/",
            title: "Overview",
            description: "View your pitch details, recent bookings, analytics, payments, and suggestions.",
            disabled: false,
            refPitch: true
        },
        {
            key: "settings",
            href: "/settings",
            title: "Settings",
            description: "Manage your pitch settings and create invitations to add managers.",
            disabled: false,
            refPitch: false
        },
        {
            key: "bookings",
            href: "/bookings/view/all",
            title: "Bookings",
            description: "Create, manage, and filter bookings for your pitch.",
            disabled: isDisabled,
            subviews: [
                { key: "bookings/view", title: "View Bookings", description: "View and filter bookings for your pitch.", refPitch: true },
                { key: "bookings/create", title: "Create Booking", description: "Reserve the pitch for a certain period of time for a guest or user.", refPitch: false }
            ],
        },
        {
            key: "payments",
            href: "/payments",
            title: "Payments",
            description: "Handle and view payment history.",
            disabled: isDisabled,
            refPitch: true
        },
        {
            key: "analytics",
            href: "/analytics",
            title: "Analytics",
            description: "Observe pitch performance and track your best performing grounds.",
            disabled: isDisabled,
            refPitch: true
        },
    ], [isDisabled]);

    const matchedPath = useMemo(() => {
        return (
            paths.find((p) => key === p.key) ??
            paths.flatMap((p) => p.subviews || []).find((sv) => key.startsWith(sv.key)) ??
            paths.find((p) => p.key === "overview")
        );
    }, [paths, key]);

    const { title, description, refPitch } = matchedPath!;
    const isHidden = useMemo(() => ["payments", "analytics", "bookings"].some((k) => key.startsWith(k)), [key]);

    return (
        <header className="flex flex-col gap-y-4 mt-6 mx-6">
            {
                refPitch &&
                <Link
                    className="flex items-center gap-x-1 text-blue-700 hover:underline w-fit"
                    href="/dashboard/pitches"
                >
                    <IoMdArrowBack className="size-3.5" />
                    <span className="text-[0.8125rem]">View all pitches</span>
                </Link>
            }
            <div className="flex flex-col gap-y-0.5">
                <h1 className="text-lg font-semibold">{title}</h1>
                <p className="text-gray-500 text-[0.8125rem]">{description}</p>
            </div>
            {!isHidden && (
                <div className="flex items-center gap-x-4 border-y-[1px] border-gray-200 text-[0.8125rem] mt-1">
                    {paths.map((item) => {
                        const isActive =
                            key.startsWith(item.key) ||
                            (item.subviews && item.subviews.some((sv) => key.startsWith(sv.key)));
                        const href = prefix + item.href;

                        if (item.disabled) {
                            return (
                                <span
                                    key={item.key}
                                    className="px-4 py-2.5 text-gray-300 cursor-not-allowed"
                                >
                                    {item.title}
                                </span>
                            );
                        }

                        if (isActive) {
                            return (
                                <Link
                                    key={item.key}
                                    href={href}
                                    className="px-4 py-2.5 border-b-[1px] border-blue-700 text-blue-700"
                                >
                                    {item.title}
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.key}
                                href={href}
                                className="px-4 py-2.5 text-gray-600 hover:text-black transition-colors"
                            >
                                {item.title}
                            </Link>
                        );
                    })}
                </div>
            )}
        </header>
    );
};

export default function PitchShell({
    children,
    id,
} : {
    children: ReactNode;
    id: string;
}) {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ["dashboard", "pitch", id],
        queryFn: () => fetchPitchState(id),
        initialData: () => queryClient.getQueryData(["dashboard", "pitch", id]),
    });

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center gap-y-1.5 text-center w-full h-full">
                <h1 className="font-medium text-lg">Could Not Find Pitch</h1>
                <div className="text-[0.8125rem] text-gray-500">
                    <p>
                        Could not find a pitch with the specified ID. Please make sure the
                        resource you are trying to access is available and try again.
                    </p>
                </div>
                <Link
                    className="text-blue-700 hover:underline w-fit mt-1"
                    href="/dashboard/pitches"
                >
                    <span className="text-[0.8125rem]">View all pitches</span>
                </Link>
            </div>
        );
    };

    const status = data.status;
    const isDisabled = status === "APPROVED";

    return (
        <>
            <Header id={id} isDisabled={isDisabled} />
            {children}
        </>
    );
}