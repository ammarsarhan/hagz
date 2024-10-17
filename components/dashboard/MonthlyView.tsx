import { weekdays, getCalendar } from "@/utils/date";
import { usePathname } from "next/navigation";
import { colors } from "@/utils/color";

// When we click any of the active cells, we want to: 
// 1) Change the activeDate of the parent component
// 2) Change the activeView of the parent component to 0

interface MonthlyViewProps {
    date: Date, 
    reservations: Number[], 
    color: "blue" | "emerald" | "slate",
    onChange: (date: Date) => void
}

export default function MonthlyView ({date, reservations, color, onChange} : MonthlyViewProps) {
    const home = usePathname() === "/dashboard/reservations";

    const handleCellClicked = (day: number) => {
        const newDate = new Date(date.getFullYear(), date.getMonth(), day);
        onChange(newDate);
    }

    return (
        <div className="table table-fixed w-full">
            <div className="table-row">
                {
                    weekdays.map((day, index) => {
                        return (
                            <div key={index} className="table-cell text-center border-b-[1px] p-4">{day}</div>
                        )
                    })   
                }
            </div>
            {
                getCalendar(date).map((week, index) => {
                    return (
                        <div key={index} className="table-row text-sm sm:text-base">
                            {
                                week.map((day, i) => {
                                    // Not in calendar
                                    if (day === null) {
                                        return (
                                            <div className="table-cell border-b-[1px] border-r-[1px] first:border-l-[1px] h-[10vw] bg-gray-100" key={i}></div>
                                        )
                                    }
                                    // Active cell (today)
                                    if (day === date.getDate()) {
                                        if (reservations.includes(day)) {
                                            return (
                                                <div key={i} onClick={() => handleCellClicked(day)} className={`table-cell border-b-[1px] border-r-[1px] ${colors[color][8]} text-white first:border-l-[1px] h-[10vw] p-1 sm:p-2 cursor-pointer`}>
                                                    <div className="h-full flex items-end justify-end text-right">
                                                        <div className="flex gap-x-1 sm:gap-x-[0.375rem] items-center">
                                                            <div className={`w-1 h-1 sm:w-[0.375rem] sm:h-[0.375rem] ${colors[color][0]} rounded-full hidden sm:block`}></div>
                                                            <span>{day}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        // Inactive cell (today)
                                        return (
                                            <div key={i} onClick={home ? () => handleCellClicked(day) : () => null} className={`${home && 'cursor-pointer text-black'} table-cell border-b-[1px] border-r-[1px] ${colors[color][8]} text-white first:border-l-[1px] h-[10vw] p-1 sm:p-2 transition-all`}>
                                                <div className="h-full flex items-end justify-end text-right">
                                                    <div className="flex gap-x-1 sm:gap-x-[0.375rem] items-center">
                                                        <span>{day}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    // Active cell (not today)
                                    if (reservations.includes(day)) {
                                        return (
                                            <div key={i} onClick={() => handleCellClicked(day)} className={`table-cell border-b-[1px] border-r-[1px] first:border-l-[1px] h-[10vw] ${colors[color][0]} hover:bg-gray-50 p-1 sm:p-2 cursor-pointer transition-all`}>
                                                <div className="h-full flex items-end justify-end text-right">
                                                    <div className="flex gap-x-1 sm:gap-x-[0.375rem] items-center">                                                        
                                                        <div className={`w-1 h-1 sm:w-[0.375rem] sm:h-[0.375rem] ${colors[color][8]} rounded-full`}></div>
                                                        <span>{day}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }
                                    // Inactive cell (not today)
                                    return (
                                        <div key={i} onClick={home ? () => handleCellClicked(day) : () => null} className={`${home && 'cursor-pointer hover:bg-gray-50'} table-cell border-b-[1px] border-r-[1px] first:border-l-[1px] h-[10vw] p-1 sm:p-2`}>
                                            <div className="h-full flex items-end justify-end text-right">
                                                {day}   
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                })
            }
        </div>
    )
}
