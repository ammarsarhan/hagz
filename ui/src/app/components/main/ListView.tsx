import { format } from "date-fns";
import Link from "next/link";

import { Booking } from "@/app/utils/api/client";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { IoMdGrid } from "react-icons/io";
import { motion } from "framer-motion";

export default function ListView({ bookings } : { bookings: Booking[] }) {
    const columnHelper = createColumnHelper<Booking>();

    const columns = [
        columnHelper.accessor("startDate", {
            id: "Date",
            header: "Date",
            cell: info => <span className="text-[0.8rem]">{format(info.getValue(), "dd/MM/yyyy")}</span>,
        }),
        columnHelper.accessor("referenceCode", {
            header: "Code",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("issuedTo", {
            header: "Issued To",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("status", {
            header: "Status",
            cell: info => {
                if (info.getValue() === "IN_PROGRESS") return <span className="text-[0.8rem]">In Progress</span>;
                return <span className="text-[0.8rem]">{info.getValue()[0]}{info.getValue().slice(1).toLowerCase()}</span>;
            },
        }),
        columnHelper.accessor("startDate", {
            id: "startTime",
            header: "Start Time",
            cell: info => <span className="text-[0.8rem]">{format(info.getValue(), "hh:mm a")}</span>,
        }),
        columnHelper.accessor("endDate", {
            header: "End Time",
            cell: info => <span className="text-[0.8rem]">{format(info.getValue(), "hh:mm a")}</span>,
        }),
        columnHelper.accessor("grounds", {
            header: "Ground(s)",
            cell: info => {
                const names = info.getValue().map(g => g.name).join(" & ")
                return <span className="text-[0.8rem]">{names}</span>
            },
        }),
    ];

    const table = useReactTable({
        data: bookings,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="px-6">
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
                    return (
                        <Link href={`/booking/${row.original.id}`} key={row.id} className="grid grid-cols-7 w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-xs hover:bg-gray-50 cursor-pointer transition-colors">
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
                        <h2 className="text-sm font-medium">No bookings found.</h2>
                        <p className="text-xs text-gray-600">You can either manually create a booking as an owner or wait for a user to book your ground.</p>
                    </div>
                </div>
            }
        </motion.div>
    )
}
