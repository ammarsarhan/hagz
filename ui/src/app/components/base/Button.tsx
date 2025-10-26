export default function Button({ children, className, ...props } : { children: React.ReactNode, className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button className={`flex items-center gap-x-1 rounded-full px-6 py-3 text-black bg-white border-[1px] border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer text-[0.8125rem] ${className ?? ""}`} {...props}>
            {children}
        </button>
    )
}
