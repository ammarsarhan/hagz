import Switch from "@/components/ui/Switch"
import { getMonth, getYear } from "@/utils/date"

import { MoreHorizontal, Plus, ChevronRight, ChevronLeft } from "lucide-react"

export default function Reservations () {
    return (
        <>
            <div className="flex flex-col sm:flex-row flex-wrap justify-between items-center gap-y-4 py-4">
                <div className="flex items-center gap-x-4">
                    <button>
                        <ChevronLeft className="w-5 h-5"/>
                    </button>
                    <span className="text-dark-gray text-base">{getMonth()} {getYear()}</span>
                    <button>
                        <ChevronRight className="w-5 h-5"/>
                    </button>
                </div>
                <div className="flex items-center gap-x-8">
                    <Switch options={["Daily", "Weekly", "Monthly"]} active={1}/>
                    <div className="fixed bottom-6 right-6 sm:static flex items-center gap-x-4">
                        <button>
                            <MoreHorizontal className="w-5 h-5"/>
                        </button>
                        <button>
                            <Plus className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}