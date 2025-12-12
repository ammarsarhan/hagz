"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { fetchPitches } from "@/app/utils/api/client";
import { PitchDetails, PitchLayout, PitchScheduleItem, PitchStatus } from "@/app/utils/types/pitch";
import { getAvatarColor } from "@/app/utils/color";

import { LuColumns3 } from "react-icons/lu";
import { BiPlus } from "react-icons/bi";
import { IoFilter, IoSearchSharp } from "react-icons/io5";
import { IoMdGrid } from "react-icons/io";

interface PitchesTableItem {
    role: "Manager" | "Owner";
    id: string;
    name: string;
    location: string;
    grounds: string[];
    combinations: string[];
    managers: string[];
    status: PitchStatus;
}

const PitchStatusLabel = ({ status } : { status: PitchStatus }) => {
    switch (status) {
        case "PENDING":
            return <span className="text-xs text-yellow-600 border-[1px] border-yellow-600 rounded-full px-3 py-1">Pending</span>
        case "APPROVED":
            return <span className="text-xs text-green-700 border-[1px] border-green-700 rounded-full px-3 py-1">Approved</span>
        case "LIVE":
            return <span className="text-xs text-green-700 border-[1px] border-green-700 rounded-full px-3 py-1">Live</span>
        case "ARCHIVED":
            return <span className="text-xs text-red-600 border-[1px] border-red-600 rounded-full px-3 py-1">Archived</span>
    }
};

const PitchesTable = ({ data } : { data : PitchesTableItem[] }) => {
    const columnHelper = createColumnHelper<PitchesTableItem>();

    const columns = [
        columnHelper.accessor("role", {
            header: () => <span>Role</span>,
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>
        }),
        columnHelper.accessor("name", {
            header: () => <span>Name</span>,
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>
        }),
        columnHelper.accessor("location", {
            header: () => <span>Location</span>,
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>
        }),
        columnHelper.accessor("grounds", {
            header: () => <span>Grounds</span>,
            cell: info => {
                const grounds = info.getValue();

                return (
                    <div className="flex items-center justify-center gap-y-1.5 gap-x-2 flex-wrap">
                        {
                            grounds.slice(0, 2).map((ground, index) => <span key={index} className="text-xs text-blue-700 border-[1px] border-blue-700 rounded-full px-3 py-1 max-w-20 truncate">{ground}</span>)
                        }
                        {
                            grounds.length > 2 && (
                                <span className="text-xs text-gray-500">
                                + {grounds.length - 2} more...
                                </span>
                            )
                        }
                    </div>
                );
            }
        }),
        columnHelper.accessor("combinations", {
            header: () => <span>Combinations</span>,
            cell: info => {
                const combinations = info.getValue();
                
                if (combinations.length === 0) {
                    return <span className="text-[0.8125rem] text-gray-500">No combinations</span>
                };

                return (
                    <div className="flex items-center justify-center gap-y-1.5 gap-x-2 flex-wrap">
                        {
                            combinations.slice(0, 2).map((combination, index) => <span key={index} className="text-xs text-blue-700 border-[1px] border-blue-700 rounded-full px-3 py-1 max-w-20 truncate">{combination}</span>)
                        }
                        {
                            combinations.length > 2 && (
                                <span className="text-xs text-gray-500 block">
                                    + {combinations.length - 2} more...
                                </span>
                            )
                        }
                    </div>
                );            
            }
        }),
        columnHelper.accessor("managers", {
            header: () => <span>Managers</span>,
            cell: info => {
                const managers = info.getValue();

                if (managers.length === 0) {
                    return <span className="text-[0.8125rem] text-gray-500">No other managers</span>
                };

                return (
                    <div className="flex items-center justify-center flex-wrap">
                        {
                            managers.slice(0, 3).map((manager, index) => {
                                return (
                                    <div
                                        key={index}
                                        className={`rounded-full size-7 ${getAvatarColor(manager)} flex items-center justify-center -ml-1.5`}
                                        title={manager}
                                    >
                                        <span className="text-xs text-white">
                                        {manager[0].toUpperCase()}
                                        </span>
                                    </div>
                                );
                            })
                        }
                        {
                            managers.length > 3 && (
                                <span className="text-xs text-gray-500 ml-1">
                                and {managers.length - 3} more
                                </span>
                            )
                        }
                    </div>
                );  
            }
        }),
        columnHelper.accessor("status", {
            header: () => <span>Status</span>,
            cell: info => <PitchStatusLabel status={info.getValue()}/>
        })
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="px-6">
            {
                table.getHeaderGroups().map(headerGroup => {
                    return (
                        <div className="grid grid-cols-7 w-full border-[1px] border-gray-200 rounded-t-xs bg-gray-50 text-[0.8125rem]" key={headerGroup.id}>
                            {
                                headerGroup.headers.map(header => {
                                    return (
                                        <div key={header.id} className="flex-1 p-2">
                                            <h6 className="text-center">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </h6>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                })
            }
            {
                table.getRowModel().rows.length > 0 ?
                table.getRowModel().rows.map(row => {
                    const isPending = row.original.status === "PENDING";

                    if (isPending) {
                        return (
                            <div key={row.id} className="grid grid-cols-7 w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-xs cursor-not-allowed transition-colors">
                                {
                                    row.getVisibleCells().map(cell => {
                                        return (
                                            <div key={cell.id} className="flex-1 flex items-center justify-center p-2">
                                                <span className="text-center">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </span>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        )
                    };

                    return (
                        <Link href={`/dashboard/pitch/${row.original.id}`} key={row.id} className="grid grid-cols-7 w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-xs hover:bg-gray-50 cursor-pointer transition-colors">
                            {
                                row.getVisibleCells().map(cell => {
                                    return (
                                        <div key={cell.id} className="flex-1 flex items-center justify-center p-2">
                                            <span className="text-center">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </span>
                                        </div>
                                    )
                                })
                            }
                        </Link>
                    )
                }) :
                <div className="flex flex-col gap-y-3 items-center justify-center px-4 py-6 border-b-[1px] border-x-[1px] border-gray-200 rounded-b-sm">
                    <div className="flex flex-col gap-y-0.5 items-center">
                        <IoMdGrid className="size-6 text-blue-800 mb-1"/>
                        <h2 className="text-sm font-medium">You do not have any pitches yet.</h2>
                        <p className="text-xs text-gray-600">You need at least one pitch to start creating bookings with Hagz.</p>
                    </div>
                </div>
            }
        </div>
    )
};

type PitchDetailsDataType = Pick<PitchDetails, "id" | "name" | "street" | "area" | "city" | "country" | "status" | "googleMapsLink">;

type PitchDataType = PitchDetailsDataType & {
    role: "Manager" | "Owner";
    layout: PitchLayout;
    schedule: Omit<PitchScheduleItem, "peakHours" | "offPeakHours">;
    permissions: Array<{
        manager: {
            user: {
                firstName: string;
                lastName: string;
            }
        }
    }>;
};

const pitchHelper = (pitches: PitchDataType[]) : PitchesTableItem[] => {
    const parsed = pitches.map(pitch => ({
        role: pitch.role,
        id: pitch.id,
        name: pitch.name,
        location: `${pitch.street}, ${pitch.area}, ${pitch.city}`,
        grounds: pitch.layout.grounds.map(ground => ground.name),
        combinations: pitch.layout.combinations.map(combination => combination.name),
        managers: pitch.permissions.map(item => `${item.manager.user.firstName} ${item.manager.user.lastName}`),
        status: pitch.status
    }));

    return parsed;
}

export default function Pitches() {
    const { data } = useQuery({
        queryFn: fetchPitches,
        queryKey: ["dashboard", "pitches"],
    });

    const pitches = pitchHelper(data);

    const isPending = useMemo(() => {
        const hasPending = pitches.find(pitch => pitch.status === "PENDING");
        return hasPending ? true : false;
    }, [pitches]);

    const [search, setSearch] = useState("");

    return (
        <>
            <header className="flex flex-col gap-y-4 mt-7 mx-6">
                <div className="flex flex-col gap-y-0.5">
                    <h1 className="text-lg font-semibold">All Pitches</h1>
                    <p className="text-gray-500 text-[0.8125rem]">
                        Track, view, and filter all of your pitches.
                    </p>
                </div>
                <div className="flex items-center justify-between py-2.5 gap-x-32 border-y border-gray-200 text-[0.8125rem] mt-1 px-2">
                    <div className="flex items-center gap-x-2">
                        <button className="flex items-center gap-x-1.5 border-[1px] border-gray-200 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                            <LuColumns3 className="size-3.5" />
                            <span className="text-xs">Columns</span>
                        </button>
                        <button className="flex items-center gap-x-1.5 border-[1px] border-gray-200 rounded-md px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
                            <IoFilter className="size-3.5" />
                            <span className="text-xs">Filters</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-x-3">
                        <div className="w-96 relative pr-3 border-r-[1px] border-gray-200">
                            <IoSearchSharp className="size-4 absolute top-1/2 left-2 -translate-y-1/2 text-gray-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                type="text"
                                className="w-full border border-gray-200 rounded-md py-2 pr-2 pl-7 text-xs"
                                placeholder="Search"
                            />
                        </div>
                        {
                            isPending ?
                            <button className="flex items-center gap-x-1 border-[1px] border-transparent bg-gray-500 text-white rounded-md px-3 py-2 cursor-not-allowed transition-colors">
                                <BiPlus className="size-4" />
                                <span className="text-xs">Add Pitch</span>
                            </button> :
                            <Link href="/dashboard/pitches/create">
                                <button className="flex items-center gap-x-1 border-[1px] border-transparent bg-blue-800 text-white rounded-md px-3 py-2 cursor-pointer hover:bg-blue-800/90 transition-colors">
                                    <BiPlus className="size-4" />
                                    <span className="text-xs">Add Pitch</span>
                                </button>
                            </Link>
                        }
                    </div>
                </div>
            </header>
            <div className="my-4">
                <PitchesTable data={pitches}/>
            </div>
        </>
    );
}
