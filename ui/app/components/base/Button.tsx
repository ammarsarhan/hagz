type ButtonVariant = "primary" | "secondary" | "mono" | "outline";
type ButtonType = "button" | "submit" | "reset";

export default function Button({ type = "button", variant = "primary", children } : { type?: ButtonType, variant?: ButtonVariant, children: React.ReactNode }) {
    const base = "px-6 py-2.5 flex items-center justify-center gap-x-2 rounded-full border cursor-pointer text-xxs transition-colors group"

    switch (variant) {
        case "primary":
            return (
                <button type={type} className={`${base} bg-primary hover:bg-primary/90 border-transparent`}>
                    {children}
                </button>
            )
        case "mono":
            return (
                <button type={type} className={`${base} bg-black hover:bg-black/85 border-transparent text-white`}>
                    {children}
                </button>
            )
        case "outline":
            return (
                <button type={type} className={`${base} bg-transparent hover:bg-gray-100 border-gray-200`}>
                    {children}
                </button>
            )
    }
}