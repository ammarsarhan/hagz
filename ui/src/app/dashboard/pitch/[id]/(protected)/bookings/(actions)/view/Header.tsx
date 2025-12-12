"use client";

import Link from "next/link";
import { useParams, useSelectedLayoutSegment } from "next/navigation";

import { BiPlus } from "react-icons/bi";
import { CgSandClock } from "react-icons/cg";
import { MdPendingActions } from "react-icons/md";
import { TbTableExport } from "react-icons/tb";
import { FaReceipt, FaRegCircleCheck } from "react-icons/fa6";

const paths = [
    {
        key: "all",
        href: "/all",
        title: "All Bookings",
        icon: <FaReceipt className="size-3.5"/>
    },
    {
        key: "pending",
        href: "/pending",
        title: "Pending",
        icon: <CgSandClock className="size-4"/>
    },
    {
        key: "approved",
        href: "/approved",
        title: "Approved",
        icon: <MdPendingActions className="size-4"/>
    },
    {
        key: "confirmed",
        href: "/confirmed",
        title: "Confirmed",
        icon: <FaRegCircleCheck className="size-3.5"/>
    },
];

export default function Header() {
    const params = useParams<{ id: string }>();
    const key = useSelectedLayoutSegment();

    const { id } = params;
    const prefix = `/dashboard/pitch/${id}/bookings/view`;

    return (
        <div className="mx-6 mt-5 border-y-[1px] border-gray-200 flex items-center justify-between text-[0.8rem]">
            <div className="flex items-center gap-x-4">
                {
                    paths.map(item => {
                        const isActive = item.key === key;
                        const href = prefix + item.href;

                        if (isActive) {
                            return (
                                <Link className="px-4 py-3 border-b-[1px] border-blue-700 text-blue-700 flex items-center gap-x-2" key={item.key} href={href}>
                                    {item.icon}
                                    <span>{item.title}</span>
                                </Link>
                            )
                        };

                        return (
                            <Link className="px-4 py-3 text-gray-600 hover:text-black transition-colors flex items-center gap-x-2" key={item.key} href={href}>
                                {item.icon}
                                <span>{item.title}</span>
                            </Link>
                        );
                    })
                }
            </div>
            <div className="flex gap-x-1.5">
                <button className="flex items-center gap-x-1.5 border-[1px] border-gray-200 hover:bg-gray-50 rounded-md px-3 py-2 cursor-pointer transition-colors">
                    <TbTableExport className="size-3.5"/>
                    <span className="text-xs">Export Data</span>
                </button>
                <Link href={`/dashboard/pitch/${id}/bookings/create`} className="flex items-center gap-x-1 border-[1px] border-transparent bg-black hover:bg-black/80 text-white rounded-md px-3 py-2 cursor-pointer transition-colors">
                    <BiPlus className="size-3.5"/>
                    <span className="text-xs">Add Booking</span>
                </Link>
            </div>
        </div>
    )
};
