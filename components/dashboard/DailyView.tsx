type Reservation = { id: string, start: Date, end: Date, recurring: boolean };

import { hours } from "@/utils/date";
import { colors } from "@/utils/color";

function TimeCell ({time, className} : {time: string, className?: string}) {
    return (
        <div className={`table-cell w-1/6 bg-gray-100 p-6 border-x-[1px] border-b-[1px] ${className}`}>
            <div className="flex-center text-center">
                {time}
            </div>
        </div>
    )
}

function ReservationCell ({variant, className, color} : {
    variant: "inactive" | "next" | "active" | "recurring", 
    className?: string, 
    color: "blue" | "emerald" | "slate"
}) {
    switch (variant) {
        case "inactive":
            return (
                <div className={`table-cell w-5/6 p-6 border-b-[1px] border-r-[1px] ${className}`}>
                </div>
            )
        case "next":
            return (
                <div className="table-cell w-5/6 p-6 border-b-[1px] border-r-[1px]">
                </div>
            )
        case "active":
            return (
                <div className={`table-cell w-5/6 p-6 ${colors[color][1]} border-b-[1px] border-r-[1px] ${className}`}>
                    <div className="flex-center gap-x-3 w-full">
                        <div className="flex-center flex-col">
                            <span>#134524647</span>
                            <span className="text-xs text-dark-gray">00:00 - 01:00</span>
                        </div>
                    </div>
                </div>
            )
        case "recurring":
            return (
                <div className={`table-cell w-5/6 p-6 ${colors[color][8]} text-gray-50 border-b-[1px] border-r-[1px] ${className}`}>
                    <div className="flex-center gap-x-3 w-full">
                        <div className="flex-center flex-col">
                            <span>#134524647</span>
                            <span className="text-xs text-gray-50">02:00 - 03:00</span>
                        </div>
                    </div>
                </div>
            )
    }
}

export default function DailyView ({date, reservations, color} : {
    date: Date, 
    reservations: Reservation[], 
    color: "blue" | "emerald" | "slate"
}) {
    // We're looking to fill up this array with 24 elements, 0-23.
    // If a reservation exists at that time, we'll fill it with the reservation object.
    // Need to get the start time of the reservation and compare it to the index of the array.
    // If a reservation does not exist at that time, we'll fill it with null.

    let reservationCells: (Reservation | null)[] = [];

    reservations.map(reservation => {
        let start = reservation.start.getHours();
        reservationCells[start] = reservation;
    })

    for (let i = 0; i <= 23; i++) {
        reservationCells[i] ? null : reservationCells[i] = null;
    }

    return (
        <div className="table table-fixed text-sm pb-2">
            {
                reservationCells.map((reservation, index) => {
                    if (reservation?.recurring) {
                        return (
                            <div className="table-row" key={index}>
                                <TimeCell time={hours[index]} className={index == 0 ? "border-t-[1px]" : ""}/>
                                <ReservationCell variant="recurring" className={index == 0 ? "border-t-[1px]" : ""} color={color}/>
                            </div>
                        )
                    }
                    if (reservation?.recurring === false) {
                        return (
                            <div className="table-row" key={index}>
                                <TimeCell time={hours[index]} className={index == 0 ? "border-t-[1px]" : ""}/>
                                <ReservationCell variant="active" className={index == 0 ? "border-t-[1px]" : ""} color={color}/>
                            </div>
                        )
                    }
                    return (
                        <div className="table-row" key={index}>
                            <TimeCell time={hours[index]} className={index == 0 ? "border-t-[1px]" : ""}/>
                            <ReservationCell variant="inactive" className={index == 0 ? "border-t-[1px]" : ""} color={color}/>
                        </div>
                    )
                })
            }
        </div>
    )
}