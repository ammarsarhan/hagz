import { ReactNode, useState } from "react";
import { X } from "lucide-react";

export default function Banner({ children } : { children: ReactNode }) {
    const [show, setShow] = useState(true);

    if (show) {
        return (
            <div className="flex-center relative w-full py-4 px-2 text-center text-sm border-b-[1px] bg-gray-100">
                <button className="absolute right-3" onClick={() => setShow(false)}>
                    <X className="w-4 h-4 text-gray-500"/>
                </button>
                { children }
            </div>
        )
    }
}