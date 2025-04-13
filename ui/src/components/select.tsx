import { ChevronsUpDown } from "lucide-react";
import { ReactNode } from "react";

export default function SelectTrigger({ children } : { children: ReactNode }) {
    return (
        <button className="p-3 border-[1px] rounded-md flex items-center justify-between gap-x-8 w-full text-gray-500 hover:bg-gray-100 hover:text-black transition-all">
            {children}
            <ChevronsUpDown className="w-4 h-4"/>
        </button>
    )
}