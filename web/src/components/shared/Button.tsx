import type { ReactNode } from "react";

export default function Button({ children, className } : { children: ReactNode, className?: string }) {
    let base = `flex items-center gap-x-1.5 px-6 py-2 rounded-full cursor-pointer border border-transparent transition-all ${className}`;
    
    return (
        <button className={base}>
            {children}
        </button>
    )
}