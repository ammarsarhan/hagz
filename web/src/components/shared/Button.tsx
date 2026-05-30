import type { ButtonHTMLAttributes, ReactNode } from "react";

export default function Button({ children, type = "button", className } : { children: ReactNode, type?: ButtonHTMLAttributes<HTMLButtonElement>['type'], className?: string }) {
    let base = `flex items-center gap-x-1.5 px-6 py-2 rounded-full cursor-pointer border border-transparent transition-all ${className}`;
    
    return (
        <button className={base} type={type}>
            {children}
        </button>
    )
}