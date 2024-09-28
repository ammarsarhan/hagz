import { ReactNode } from "react"

interface ButtonProps {
    variant: string,
    onClick?: () => void,
    children?: ReactNode,
    className?: string,
    style?: object
}

export default function Button ({ variant, onClick, children, className, style }: ButtonProps) {
    let buttonStyle = "px-6 py-3 rounded-full text-sm hover:bg-opacity-90 transition-all ";

    switch (variant) {
        case "primary":
            buttonStyle += "border-[1px] border-light-gray text-primary-black hover:bg-gray-50";
            break;
        case "secondary":
            buttonStyle += "border-[1px] border-primary-black bg-primary-black text-white";
            break;
        case "disabled":
            buttonStyle += "border-[1px] bg-light-gray text-black cursor-auto";
            break;
        case "color":
            buttonStyle += "border-[1px] border-primary-black bg-primary-green text-white";
            break;
    }

    className && (buttonStyle += ` ${className}`);
    return <button onClick={onClick} className={buttonStyle} disabled={variant === "disabled"} style={style}>{children}</button>
}