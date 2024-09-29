import { ChevronsUpDown } from "lucide-react"

export default function Selector () {
    return (
        <div className="flex items-center justify-between gap-4 cursor-pointer px-2 py-4 text-sm hover:bg-gray-50 transition-all rounded-md">
            <div className="flex items-center gap-x-4">
                <div className="w-5 h-5 bg-primary-green rounded-md"></div>
                <div className="flex flex-col gap-[0.15rem]">
                    <span className="text-primary-black font-semibold">El Nasr Football Club</span>
                    <span className="text-dark-gray text-xs">Alexandria, Egypt</span>
                </div>
            </div>
            <ChevronsUpDown className="w-4 h-4"/>
        </div>
    )
}