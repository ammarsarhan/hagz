interface ButtonProps {
    label: string
    variant: string
    className?: string
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export default function Button ({label, variant = "primary", className, onClick}: ButtonProps) {
    // Binding custom className to button style
    const buttonStyle = `${className} py-3 px-16 rounded-full text-sm font-light hover:bg-opacity-95 transition duration-1 ease-in-out`;

    switch (variant) {
        case "primary":
            return <button onClick={onClick} className={`${buttonStyle} bg-secondary text-primary border-[1px] border-primary`}>{label}</button>
        case "secondary":
            return <button onClick={onClick} className={`${buttonStyle} bg-primary text-secondary`}>{label}</button>
        case "monochrome":
            return <button onClick={onClick} className={`${buttonStyle} bg-label-primary text-label-secondary`}>{label}</button>
        case "inverted":
            return <button onClick={onClick} className={`${buttonStyle} bg-label-secondary text-label-primary`}>{label}</button>
        default:
            return <button onClick={onClick} className={`${buttonStyle} bg-secondary text-primary`}>{label}</button>
    }
}