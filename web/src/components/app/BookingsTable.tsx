import formatCurrency from "#/lib/currency";
import type { UserBooking } from "#/lib/types/booking";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

export default function BookingsTable({ data } : { data: Array<UserBooking> }) {
    const columnHelper = createColumnHelper<UserBooking>();

    const columns = [
        columnHelper.accessor('pitch.name', {
            header: "Pitch",
            cell: info => {
                return <span>{info.getValue()}</span>
            }
        }),
        columnHelper.accessor('ground.name', {
            header: "Ground",
            cell: info => {
                return <span>{info.getValue()}</span>
            }
        }),
        columnHelper.accessor('startTime', {
            header: "Starts at",
            cell: info => {
                return <span>{new Date(info.getValue()).toDateString()}</span>
            }
        }),
        columnHelper.accessor('status', {
            header: "Status",
            cell: info => {
                const label = `${info.getValue()[0].toUpperCase()}${info.getValue().slice(1).toLowerCase()}`
                return <span>{label}</span>
            }
        }),
        columnHelper.accessor('totalAmount', {
            header: "Price",
            cell: info => {
                const label = formatCurrency(info.getValue())
                return <span>{label}</span>
            }
        })
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel()
    })

    return (
        <table>
            <thead>
                {
                    table.getHeaderGroups().map(group => (
                        <tr key={group.id}>
                            {
                                group.headers.map(header => (
                                    <th key={header.id}>
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
                        <tr key={row.id}>
                            {
                                row.getVisibleCells().map(cell => (
                                    <td key={cell.id}>
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