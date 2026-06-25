import type { ReactNode } from "react";

export default function Button({ children, className } : { children: ReactNode, className?: string }) {
    const base = "flex px-4 py-2.5 rounded-lg cursor-pointer transition-all";

    return (
        <button className={className ? `${base} ${className}` : `${base}`}>
            {children}
        </button>
    )
}