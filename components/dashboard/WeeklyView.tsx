import { Reservation } from "@/utils/types/reservation"
import { getWeekdays } from "@/utils/date"

export default function WeeklyView ({date, reservations} : {date: Date, reservations: Reservation[]}) {

    return (
        <div className="table table-fixed">
            <div className="table-row text-center">
                <div className="table-cell text-dark-gray text-sm w-[12.5%]">
                    UTC+2
                </div>
                {
                    getWeekdays(date).map(element => (
                        <div className={`${element.index == 0 ? "text-blue-600 text-lg" : ""} table-cell w-[12.5%]`}>{element.day}</div>
                    ))
                }
            </div>
        </div>
    )
}