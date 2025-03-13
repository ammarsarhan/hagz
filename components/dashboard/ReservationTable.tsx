import Reservation, { ReservationStatus } from "@/utils/types/reservation"
import { PaymentStatus } from "@/utils/types/payment"
import useReservationContext from "@/context/useReservationContext"
import getCurrencyFormat from "@/utils/currency"

import { Ellipsis } from "lucide-react"
import Skeleton from "react-loading-skeleton"
import { useRouter } from "next/navigation"

export function ReservationTableStatus ({status} : {status: ReservationStatus}) {
    let className = 'w-fit py-1 px-2 rounded-md text-xs';

    switch (status) {
        case "Pending":
            className += ' bg-yellow-700 text-yellow-200';
            break;
        case "Cancelled":
            className += ' bg-red-700 text-red-200';
            break;
        case "Confirmed":
            className += ' bg-green-700 text-green-200';
            break;
        case "Completed":
            className += ' bg-gray-700 text-gray-200';
            break;
        case "Error":
            className += ' bg-red-700 text-red-200';
            break;
    }

    return (
        <div className={className}>
            {status}
        </div>
    )
}

export function ReservationTablePaymentStatus ({status} : {status: PaymentStatus}) {
    let className = 'w-fit py-1 px-2 rounded-md text-xs border-[1px]';

    switch (status) {
        case "Pending":
            className += ' border-yellow-700 text-yellow-700';
            break;
        case "Cancelled":
            className += ' border-red-700 text-red-700';
            break;
        case "Done":
            className += ' border-green-700 text-green-700';
            break;
        case "Error":
            className += ' border-red-700 text-red-700';
            break;
    }

    return (
        <div className={className}>
            {status}
        </div>
    )
}

export function ReservationTableHeader ({labels} : {labels: string[]}) {
    const context = useReservationContext();
    const loading = context.data.tableLoading;

    if (loading) {
        return (
            <tr className="border-b-[1px]">
                {
                    labels.map((label, index) => {
                        return (
                            <th className="p-4 text-dark-gray text-center first:text-left" key={index}>
                                <Skeleton height={20}/>
                            </th>
                        )
                    })
                }
            </tr>
        )
    }

    return (
        <tr className="border-b-[1px]">
            {
                labels.map((label, index) => {
                    return (
                        <th className="p-4 text-dark-gray text-center first:text-left whitespace-nowrap" key={index}>
                            {label}
                        </th>
                    )
                })
            }
        </tr>
    )
}

export function ReservationTableRow ({reservation} : {reservation: Reservation}) {
    const startDate = new Date(reservation.startDate).toLocaleString('en-US', {hour: 'numeric', hour12: true});
    const endDate = new Date(reservation.endDate).toLocaleString('en-US', {hour: 'numeric', hour12: true});

    const router = useRouter();

    return (
        <tr className="[&>*]:p-4 [&>*]:align-middle text-center border-b-[1px] hover:bg-gray-50 hover:cursor-pointer transition-colors" onClick={() => router.push(`/dashboard/reservation/${reservation.id}/view`)}>
            <td className="text-dark-gray text-left whitespace-nowrap">{startDate}</td>
            <td className="text-dark-gray whitespace-nowrap">{endDate}</td>
            <td>{reservation.payment ? getCurrencyFormat(reservation.payment.amount) : "None"}</td>
            <td className={reservation.payment && "font-semibold"}>{reservation.payment ? getCurrencyFormat(reservation.payment.total) : "None"}</td>
            <td>
                <div className="flex-center">
                    <ReservationTablePaymentStatus status={reservation.payment ? reservation.payment.status : "Error"}/>
                </div>
            </td>
            <td className={`${reservation.recurring ? 'font-semibold' : 'text-dark-gray'}`}>
                <div className="flex-center">
                    {
                        reservation.recurring ?
                        <div className="rounded-full w-2 h-2 bg-slate-800 pulse-gray"></div> :
                        <div className="rounded-full w-2 h-2 bg-slate-300"></div>
                    }
                </div>
            </td>
            <td className="text-dark-gray">{reservation.id}</td>
            <td>
                <div className="flex-center">
                    <ReservationTableStatus status={reservation.status}/>
                </div>
            </td>
                <td>
                    {
                        reservation.isLocked &&
                        <div className="flex-center"> 
                            <button>
                                <Ellipsis className="w-4 h-4"/>
                            </button>
                        </div>
                    }
                </td>
        </tr>
    )
}

export default function ReservationTable ({reservations} : {reservations: Reservation[]}) {
    const context = useReservationContext();
    const loading = context.data.tableLoading;

    return (
        <table className="text-left text-sm">
            <thead>
                <ReservationTableHeader labels={['Start', 'End', 'Paid', 'Total', 'Payment Status', 'Recurring', 'ID', 'Status']}/>
            </thead>
            <tbody>
                {
                    loading &&
                    <tr>
                        <td colSpan={8}>
                            <Skeleton count={2} height={20} className="first:mt-4 my-2"/>
                        </td>
                    </tr>
                }
                {
                    !loading && reservations.length === 0 &&
                    <tr>
                        <td colSpan={8}>
                            <span className="block text-center my-6">No reservations found</span>
                        </td>
                    </tr>
                }
                {
                    !loading &&
                    reservations.map((reservation, index) => {
                        return (
                            <ReservationTableRow reservation={reservation} key={index}/>
                        )
                    })
                }
            </tbody>
        </table>
    )
}