import { ChevronsUpDown } from "lucide-react"
import { ReactNode } from "react"

interface SelectorProps {
    value: string
    description?: string
    className?: string
    icon?: ReactNode
    gap?: Number
}

export default function Selector ({ value, description, className, icon, gap = 4 } : SelectorProps) {
    return (
        <div className={`flex items-center justify-between gap-4 cursor-pointer px-4 py-3 text-sm hover:bg-gray-50 transition-all rounded-md ${className}`}>
            <div className={`flex items-center gap-x-${gap}`}>
                <div className="flex-center w-5 h-5 rounded-md">
                    {icon}
                </div>
                <div className="flex flex-col gap-[0.15rem]">
                    <span className="text-primary-black font-medium">{value}</span>
                    {description && <span className="text-dark-gray text-xs">{description}</span>}
                </div>
            </div>
            <ChevronsUpDown className="w-4 h-4"/>
        </div>
    )
}