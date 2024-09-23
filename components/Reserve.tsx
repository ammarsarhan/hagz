'use client'

import { useEffect, useState } from "react"

import Button from "@/components/ui/Button"
import Pulse from "@/components/ui/Pulse"
import { Calendar, Clock } from "lucide-react"

interface ReserveProps {
    available: boolean,
    price: number,
    size: number
}

export default function Reserve ({available, price, size} : ReserveProps) {    
    return (
        <div className="sticky top-24 h-fit w-full rounded-2xl p-5 bg-gray-100">
            <form className="flex flex-col gap-y-6">
                <div className="flex flex-col gap-y-6 w-full rounded-xl bg-white p-5">
                    <Pulse variant={'inactive'}/>
                    <div className="flex flex-col gap-y-2">
                        <span className="flex items-center gap-x-2 text-dark-gray"><Calendar className="inline w-4 h-4"/> Date</span>
                        <input type="text" name="day" placeholder="Reservation Date" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                    </div>
                    <div className="flex flex-col gap-y-2">
                        <span className="flex items-center gap-x-2 text-dark-gray"><Clock className="inline w-4 h-4"/> Start</span>
                        <input type="text" name="startTime" placeholder="Start Time" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                    </div>
                    <div className="flex flex-col gap-y-2">
                        <span className="flex items-center gap-x-2 text-dark-gray"><Clock className="inline w-4 h-4"/> End</span>
                        <input type="text" name="endTime" placeholder="End Time" className="w-full rounded-lg px-4 py-2 border-[1px]"/>
                    </div>
                </div>
                <div className="flex flex-col gap-y-4 rounded-2xl bg-white p-5">
                    <div className="flex items-center justify-between w-full gap-x-4">
                        <span>Pitch size</span>
                        <span className="font-semibold">{size}-A-Side</span>
                    </div>
                    <div className="flex items-center justify-between w-full gap-x-4">
                        <span>Pricing</span>
                        <span className="font-semibold">{price} EGP/hr</span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <Button variant="primary" className="py-4 w-full">Open In Maps</Button>
                    <Button variant={'color'} className="py-4 w-full">Reserve</Button>
                </div>
            </form>
        </div>
    )
}