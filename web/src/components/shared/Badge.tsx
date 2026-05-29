import type { ReactNode } from "react";

export default function Badge({ children } : { children: ReactNode }) {
    return (
        <div className="text-xs flex-center gap-x-3 py-2 px-4 border border-gray-200 w-fit rounded-full">
            <div className="size-3 rounded-full bg-primary brightness-75 animate-pulse"></div>
            {children}
        </div>
    )
}