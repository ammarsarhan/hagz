export default function Input ({placeholder, label, onChange}: {placeholder: string, label?: string, onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void}) {
    return (
        <div className="flex flex-col gap-2 w-full">
            {label && <span className="text-black">{label}</span>}
            <input 
                type="text" 
                className="bg-transparent border-b-[1px] border-primary text-primary placeholder-gray-700 py-2 text-lg w-full outline-none" 
                placeholder={placeholder}
                onChange={onChange}/>
        </div>
    )
}