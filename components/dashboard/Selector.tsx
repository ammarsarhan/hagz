import { ChevronsUpDown } from "lucide-react"

export default function Selector () {
    return (
        <div className="flex items-center justify-between gap-4 cursor-pointer border-b-[1px] py-4 text-sm">
            <div className="flex items-center gap-x-4">
                <div className="w-6 h-6 bg-primary-green rounded-md"></div>
                <div className="flex flex-col">
                    <span className="text-primary-black font-semibold">El Nasr Football Club</span>
                    <span className="text-dark-gray">Alexandria, Egypt</span>
                </div>
            </div>
            <ChevronsUpDown className="w-4 h-4"/>
        </div>
    )
}