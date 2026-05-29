import { cloneElement, type ReactElement } from "react";
import type { IconBaseProps } from "react-icons";

export default function IconCard({ icon, title, description } : { icon: ReactElement<IconBaseProps>, title: string, description: string }) {
    return (
        <div className="flex items-end relative rounded-lg border border-gray-200 w-3xs h-80 bg-gray-50 text-base overflow-clip">
            {cloneElement(icon, { className: "size-64 opacity-25 absolute -bottom-4 -right-28" })}
            <div className="absolute bottom-0 h-1/2 w-full bg-linear-to-b from-transparent to-gray-50">
            </div>
            <div className="flex flex-col gap-y-2 w-full p-4 z-10">
                <div className="rounded-md size-10 flex-center bg-white border border-gray-200 mb-2">
                    {cloneElement(icon, { className: "size-6" })}
                </div>
                <h1 className="font-medium">{title}</h1>
                <p className="text-gray-500 text-sm">{description}</p>
            </div>
        </div>
    )
}