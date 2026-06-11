import formatCurrency from "#/lib/currency";
import { formatEnum } from "#/lib/string";
import type { UserBooking } from "#/lib/types/booking";
import type { BookingStatus } from "@/generated/prisma/enums";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

function TableBadge({ status }: { status: BookingStatus }) {
    const styles: Record<BookingStatus, string> = {
        RESERVED:    "bg-yellow-50 text-yellow-600 border-yellow-600",
        CONFIRMED:   "bg-primary/10 text-primary-muted border-primary-muted",
        IN_PROGRESS: "bg-blue-50 text-blue-600 border-blue-600",
        COMPLETED:   "bg-gray-100 text-gray-500 border-gray-500",
        RESCHEDULED: "bg-yellow-50 text-yellow-600 border-yellow-600",
        EXPIRED:     "bg-orange-50 text-orange-500 border-orange-500",
        CANCELLED:   "bg-red-50 text-red-500 border-red-500",
        NO_SHOW:     "bg-red-50 text-red-500 border-red-500",
    };

    return (
        <span className={`inline-flex items-center px-3 py-1.25 rounded-full text-[0.75rem] border ${styles[status]}`}>
            {formatEnum(status)}
        </span>
    );
}

export default function BookingsTable({ data } : { data: Array<UserBooking> }) {
    const navigate = useNavigate();
    const columnHelper = createColumnHelper<UserBooking>();

    const columns = [
        columnHelper.accessor('pitch.name', {
            header: "Pitch",
            cell: info => {
                return <span className="truncate max-w-40 block">{info.getValue()}</span>
            }
        }),
        columnHelper.accessor('ground.name', {
            header: "Ground",
            cell: info => {
                return <span className="truncate max-w-40 block">{info.getValue()}</span>
            }
        }),
        columnHelper.accessor('startTime', {
            header: "Date",
            cell: info => {
                const start = new Date(info.getValue());
                const end = new Date(info.row.original.endTime);
                
                return (
                    <div className="flex flex-col">
                        <span>{start.toDateString()}</span>
                        <span className="text-gray-500 text-[0.8rem]">
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                );
            }
        }),
        columnHelper.accessor('channel', {
            header: "Channel",
            cell: info => <span className="text-gray-500 block w-24">{formatEnum(info.getValue())}</span>
        }),
        columnHelper.accessor('totalAmount', {
            header: "Price",
            cell: info => {
                const depositFee = info.row.original.depositFee;
                return (
                    <div className="flex flex-col w-24">
                        <span>{formatCurrency(info.getValue())}</span>
                        {depositFee && <span className="text-gray-500 text-[0.8rem]">({formatCurrency(depositFee)})</span>}
                    </div>
                )
            }
        }),
        columnHelper.accessor('status', {
            header: "Status",
            cell: info => {
                return <TableBadge status={info.getValue()}/> 
            }
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel()
    })

    return (
        <table className="w-full">
            <thead>
                {
                    table.getHeaderGroups().map(group => (
                        <tr key={group.id}>
                            {
                                group.headers.map(header => (
                                    <th key={header.id} className="font-normal text-left text-base py-3 border-b border-gray-200 text-gray-500 first:pl-4 last:pr-4">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ))
                            }
                        </tr>
                    ))
                }
            </thead>
            <tbody>
                {
                    table.getRowModel().rows.map(row => (
                        <tr key={row.id} className="text-left text-sm hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate({ to: "/bookings/$bookingId", params: { bookingId: row.original.id } })}>
                            {
                                row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="py-3 border-b border-gray-200 first:pl-4 last:pr-4">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))
                            }
                        </tr>
                    ))
                }
            </tbody>
        </table>
    )
}