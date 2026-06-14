import formatCurrency from "#/lib/currency";
import type { UserAnalytics } from "#/lib/types/booking";
import { Link } from "@tanstack/react-router";
import { TbArrowRight, TbFlame, TbStar } from "react-icons/tb";

export default function BookingsCards({ data } : { data: UserAnalytics }) {
    console.log(data);
    return (
        <div className='grid grid-cols-4 gap-x-4'>
            <div className='p-4 flex justify-center flex-col gap-y-1 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200'>
                <span className="text-[0.8125rem] text-gray-500">Total Spent</span>
                <h2 className="font-medium text-lg">{formatCurrency(data.totalSpent)}</h2>
                <span className="text-[0.8125rem] text-gray-500">Across {data.totalBookings} booking{data.totalBookings > 1 ? "s" : ""}</span>
            </div>
            {
                data.mostBooked &&
                <div className='p-4 flex justify-center flex-col gap-y-1 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200'>
                    <TbStar className="size-4 mb-1"/>
                    <h2 className="font-medium">{data.mostBooked.name}</h2>
                    <span className="text-[0.8125rem] text-gray-500">{data.mostBooked.count} Booking{data.mostBooked.count > 1 ? "s" : ""}</span>
                </div>
            }
            <div className='p-4 flex justify-center flex-col gap-y-1 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200'>
                <TbFlame className="size-4 mb-1"/>
                <h2 className="font-medium">You have kept a {data.weekStreak} week streak back-to-back!</h2>
                {
                    data.mostBooked &&
                    <Link to="/pitches/$pitchId/book" params={{ pitchId: data.mostBooked.pitchId }} className="group flex items-center gap-x-1 text-[0.8125rem] hover:underline text-primary-muted mt-auto w-fit">
                        <span>Book again</span>
                        <TbArrowRight className="group-hover:-rotate-45 transition" />
                    </Link>
                }
            </div>
            <div className='p-4 flex justify-center flex-col gap-y-1 rounded-md bg-linear-to-br from-gray-100 to-white border border-gray-200'>
                <span className="text-[0.8125rem] text-gray-500">All Bookings</span>
                <h2 className="font-medium">{data.totalBookings} Bookings</h2>
            </div>
        </div>
    )
}