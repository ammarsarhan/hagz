import { ReactNode } from "react";

interface ButtonProps {
    children: ReactNode
    variant?: "primary" | "secondary" | "outline" | "mono" | "none"
    className?: string
    onClick?: () => void
}

export default function Button({ children, variant = "primary", className, onClick } : ButtonProps) {
    let style = "rounded-md px-4 py-2 transition-all ease-in-out cursor-pointer";

    if (className) {
        style = style.concat(" ", className);
    };

    switch (variant) {
        case "primary":
            style = style.concat(" ", "bg-black text-white hover:bg-gray-800");
            break;
        case "secondary":
            style = style.concat(" ", "bg-black text-white");
            break;
        case "outline":
            style = style.concat(" ", "bg-white text-black border-[1px] hover:bg-gray-50");
            break;
        case "mono":
            style = style.concat(" ", "bg-black text-white");
            break;
    }

    return (
        <button className={style} onClick={onClick}>
            {children}
        </button>
    )
}