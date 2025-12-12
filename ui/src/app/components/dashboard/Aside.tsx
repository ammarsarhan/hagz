"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { OnboardingStage } from "@/app/utils/types/dashboard";
import {
    IoMdArrowForward,
    IoMdBook,
    IoIosCalendar,
    IoIosTrendingUp,
    IoIosHelpCircleOutline,
} from "react-icons/io";
import { FiHome } from "react-icons/fi";
import { IoSettingsOutline } from "react-icons/io5";
import { GrSecure } from "react-icons/gr";
import { LuLayoutGrid } from "react-icons/lu";

const AsideLink = ({
    title,
    icon,
    href,
    disabled = false,
}: {
    title: string;
    icon: React.ReactNode;
    href: string;
    disabled?: boolean;
}) => {
    const layoutSegments = useSelectedLayoutSegments();

    const segments = layoutSegments.filter((s) => !s.startsWith("(") && !s.endsWith(")"));
    const path = segments.length > 0
        ? `/dashboard/${segments.join("/")}`
        : "/dashboard";

    const isActive =
        href === "/dashboard"
        ? path === href
        : path.startsWith(href) && href !== "/dashboard";

    return (
        <Link
            href={href}
            className="flex items-center gap-x-2 mx-2"
            style={{
                pointerEvents: disabled ? "none" : "auto",
                opacity: disabled ? 0.5 : 1,
            }}
        >
            {isActive && <div className="h-6 w-0.5 bg-black" />}
            <div
                className={`flex items-center gap-x-1.5 p-2 rounded-md w-full border transition-colors ${
                isActive
                    ? "bg-white border-gray-200"
                    : "border-gray-50 text-gray-500 hover:bg-white hover:border-gray-200"
                }`}
            >
                {icon}
                <span className="font-medium text-[0.8125rem]">{title}</span>
            </div>
        </Link>
    );
};

export default function Aside({ stage } : { stage: OnboardingStage }) {
    const redirectStates = ["NO_PITCH", "PITCH_DRAFT"];
    const disabledStates = ["NO_PITCH", "PITCH_DRAFT", "PITCH_PENDING", "PUBLISHING_REQUIRED", "INACTIVE"];

    const redirectPitch = redirectStates.includes(stage);
    const isDisabled = disabledStates.includes(stage);

    return (
        <aside className="hidden fixed h-full lg:flex flex-col min-w-56 bg-gray-50 border-r border-gray-200 text-sm z-50">
            <div className="min-h-16 flex items-center justify-between bg-gray-50 px-4 border-b border-gray-200"></div>
            <div className="flex flex-col gap-y-4 h-full border-b border-gray-200 py-4 overflow-y-scroll">
                <AsideLink title="Dashboard" icon={<FiHome className="size-4"/>} href="/dashboard"/>
                <div className="flex flex-col gap-y-2">
                    <span className="px-4 text-gray-500 text-[0.8rem]">All</span>
                    <div className="flex flex-col gap-y-1">
                        <AsideLink title="Bookings" icon={<IoIosCalendar className="size-4"/>} href="/dashboard/bookings" disabled={isDisabled} />
                        <AsideLink title="Payments" icon={<IoMdBook className="size-4"/>} href="/dashboard/payments" disabled={isDisabled} />
                        <AsideLink title="Analytics" icon={<IoIosTrendingUp className="size-4"/>} href="/dashboard/analytics" disabled={isDisabled} />
                        <AsideLink title="Pitches" icon={<LuLayoutGrid className="size-4"/>} href={redirectPitch ? "/dashboard/pitches/create" : "/dashboard/pitches"} />
                    </div>
                </div>
                <div className="flex flex-col gap-y-2">
                    <span className="px-4 text-gray-500 text-[0.8rem]">Account</span>
                    <div className="flex flex-col gap-y-1">
                        <AsideLink title="Settings" icon={<IoSettingsOutline className="size-4"/>} href="/account/settings" />
                        <AsideLink title="Security" icon={<GrSecure className="size-4"/>} href="/account/security" />
                        <AsideLink title="Help" icon={<IoIosHelpCircleOutline className="size-4"/>} href="/help" />
                    </div>
                </div>
            </div>
            <div className="h-38 p-4">
                <div className="flex flex-col justify-between bg-white border border-gray-200 p-3 rounded-md h-full text-[0.8125rem]">
                    <div className="flex items-center justify-between gap-x-8 text-gray-500">
                        <span>Create a pitch</span>
                        <span>1/5</span>
                    </div>
                    <div className="relative w-full h-1.5 bg-blue-100 rounded-md">
                        <div className="absolute h-full bg-blue-700 rounded-md" style={{ width: "20%" }}></div>
                    </div>
                    <Link href="/dashboard" className="flex items-center gap-x-1 text-blue-700 hover:underline w-fit">
                        <span>View checklist</span>
                        <IoMdArrowForward className="size-3" />
                    </Link>
                </div>
            </div>
        </aside>
    );
}
