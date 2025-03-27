import { ReactNode } from "react";

interface ButtonProps {
    children: ReactNode
    disabled?: boolean
    variant?: "primary" | "secondary" | "outline" | "mono" | "none" | "disabled" | "destructive"
    className?: string
    onClick?: () => void
}

export default function Button({ children, variant = "primary", className, disabled = false, onClick } : ButtonProps) {
    let style = "px-4 py-2 transition-all ease-in-out cursor-pointer";

    if (className) {
        style = style.concat(" ", className);
    };

    if (disabled) {
        variant = "disabled"
    };

    switch (variant) {
        case "primary":
            style = style.concat(" ", "bg-black text-white hover:bg-gray-800");
            break;
        case "secondary":
            style = style.concat(" ", "bg-blue-800 text-white hover:bg-blue-700");
            break;
        case "outline":
            style = style.concat(" ", "bg-white text-black border-[1px] hover:bg-gray-50");
            break;
        case "mono":
            style = style.concat(" ", "bg-black text-white");
            break;
        case "disabled":
            style = style.concat(" ", "bg-gray-700 text-white");
            break;
        case "destructive":
            style = style.concat(" ", "border-red-600! bg-red-50 text-red-600 border-[1px] hover:bg-red-100");
            break;
    }

    return (
        <button className={style} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    )
}