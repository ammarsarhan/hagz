type ButtonVariant = "primary" | "secondary" | "mono" | "outline";
type ButtonType = "button" | "submit" | "reset";

export default function Button({ type = "button", variant = "primary", className, children, disabled, onClick } : { type?: ButtonType, variant?: ButtonVariant, className?: string, disabled?: boolean, children: React.ReactNode, onClick?: () => void }) {
    const base = `px-6 py-2.5 flex items-center justify-center gap-x-2 rounded-full border text-xxs transition-colors group ${className}`

    switch (variant) {
        case "primary":
            return (
                <button onClick={onClick} type={type} className={`bg-primary hover:bg-primary/90 border-transparent ${base}`} disabled={disabled}>
                    {children}
                </button>
            )
        case "mono":
            return (
                <button onClick={onClick} type={type} className={`$bg-black hover:bg-black/85 border-transparent text-white {base}`} disabled={disabled}>
                    {children}
                </button>
            )
        case "outline":
            return (
                <button onClick={onClick} type={type} className={`bg-transparent hover:bg-gray-100 border-gray-200 ${base}`} disabled={disabled}>
                    {children}
                </button>
            )
    }
}