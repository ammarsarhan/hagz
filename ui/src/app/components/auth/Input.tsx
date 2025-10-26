export default function Input({ label, ...props } : { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    if (label) {
        return (
            <div className="flex flex-col gap-y-1.5 w-full flex-1">
                <span className="font-medium">{label}</span>
                <input type="text" className={`border-b-[1px] border-gray-300 py-1 outline-none ${props?.className}`} {...props}/>
            </div>
        )
    }
    
    return (
        <input type="text" className={`border-b-[1px] border-gray-300 py-1 outline-none ${props?.className}`} {...props}/>
    )
}
