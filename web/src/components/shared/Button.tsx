import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps {
    children: ReactNode, 
    type?: ButtonHTMLAttributes<HTMLButtonElement>['type'], 
    disabled?: boolean, 
    className?: string, 
    onClick?: () => void
}

export default function Button({ children, type = "button", disabled = false, className, onClick } : ButtonProps) {
    let base = `flex items-center gap-x-1.5 px-6 py-2 rounded-full cursor-pointer border border-transparent transition-all ${className}`;
    
    return (
        <button className={base} type={type} disabled={disabled} onClick={onClick}>
            {children}
        </button>
    )
}