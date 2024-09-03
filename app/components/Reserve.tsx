'use client'

import { useState } from "react"

import Button from "@/app/components/Button"
import Pulse from "@/app/components/Pulse"
import { Calendar, Clock } from "lucide-react"

interface ReserveProps {
    available: boolean,
    price: number,
    size: number
}

export default function Reserve ({available, price, size} : ReserveProps) {
    const [filled, setFilled] = useState(false);
    
    return (
        <div className="sticky top-24 flex flex-col gap-y-6 h-fit w-full rounded-2xl p-5 bg-gray-100">
            <div className="flex flex-col gap-y-6 w-full rounded-xl bg-white p-5">
                <Pulse variant={(available && filled) ? 'positive' : (filled ? 'negative' : 'inactive')}/>
                <div className="flex flex-col gap-y-2">
                    <span className="flex items-center gap-x-2 text-dark-gray"><Calendar className="inline w-4 h-4"/> Date</span>
                    <input type="text" placeholder="Reservation Date" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                </div>
                <div className="flex flex-col gap-y-2">
                    <span className="flex items-center gap-x-2 text-dark-gray"><Clock className="inline w-4 h-4"/> Start</span>
                    <input type="text" placeholder="Start Time" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                </div>
                <div className="flex flex-col gap-y-2">
                    <span className="flex items-center gap-x-2 text-dark-gray"><Clock className="inline w-4 h-4"/> End</span>
                    <input type="text" placeholder="End Time" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                </div>
            </div>
            <div className="flex flex-col gap-y-4 rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between w-full">
                    <span>Pitch size</span>
                    <span className="font-semibold">{size}-A-Side</span>
                </div>
                <div className="flex items-center justify-between w-full">
                    <span>Pricing per hour</span>
                    <span className="font-semibold">{price} EGP/hour</span>
                </div>
            </div>
            <div className="flex gap-x-4 w-full">
                <Button variant="primary" className="py-4 w-full">Open In Maps</Button>
                <Button variant={(available && filled) ? 'color' : 'disabled'} className="py-4 w-full">Reserve</Button>
            </div>
        </div>
    )
}