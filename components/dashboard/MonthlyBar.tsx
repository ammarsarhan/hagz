import { today, isDate, getDayName } from "@/utils/date"
import Skeleton from "react-loading-skeleton";
import useReservationContext from "@/context/useReservationContext";

export function MonthlyBarCell ({date, variant = "Other", onClick} : {date: Date, variant?: "Today" | "Active" | "Other", onClick?: () => void}) {
    const context = useReservationContext();
    const loading = context.data.loading;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-sm rounded-md">
                <Skeleton width={50} height={50}/>
            </div>
        )
    }

    if (variant == "Active") {
        return (
            <button className="flex flex-col items-center justify-center text-center text-sm bg-blue-800 border-blue-800 border-[1px] text-gray-50 px-4 py-2 rounded-md" onClick={onClick}>
                <span>{date?.toLocaleDateString('en-uk', { day: 'numeric' })}</span>
                <span>{getDayName(date)}</span>
            </button>
        )
    }

    if (variant == "Today") {
        return (
            <button className="flex flex-col items-center justify-center text-center text-sm bg-blue-50 text-blue-800 border-[1px] border-blue-800 px-4 py-2 rounded-md" onClick={onClick}>
                <span>{date?.toLocaleDateString('en-uk', { day: 'numeric' })}</span>
                <span>{getDayName(date)}</span>
            </button>
        )
    }

    return (
        <button className="flex flex-col items-center justify-center text-center text-sm bg-white text-black border-[1px] px-4 py-2 rounded-md" onClick={onClick}>
            <span>{date?.toLocaleDateString('en-uk', { day: 'numeric' })}</span>
            <span>{getDayName(date)}</span>
        </button>
    )
}

export default function MonthlyBar({ days } : { days: Date[] }) {
    const context = useReservationContext();
    const loading = context.data.loading;

    return (
        <div className={`flex items-center w-full gap-x-4 mt-2 mb-5 ${loading ? 'overflow-x-hidden' : 'overflow-x-scroll'}`}>
            {
                days.map((date, index) => {
                    if (isDate(date, context.data.activeDate)) {
                        return (
                            <MonthlyBarCell 
                                date={date} 
                                variant="Active" 
                                key={index} 
                                onClick={() => context.actions.setActiveDate(date)}
                            />
                        )
                    }

                    if (isDate(date, today)) {
                        return (
                            <MonthlyBarCell 
                                date={date} 
                                variant="Today"
                                key={index} 
                                onClick={() => context.actions.setActiveDate(date)}/>
                            )
                    }

                    return (
                        <MonthlyBarCell 
                            date={date}
                            key={index} 
                            onClick={() => context.actions.setActiveDate(date)}
                        />
                    )
                })
            }
        </div>
    )
}