import { FaChevronDown } from "react-icons/fa6";

interface SelectProps {
    label: string, 
    options: Array<{ value: string; label: string }> 
}

export default function Select({ label, options, ...props } : SelectProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div className="flex flex-col gap-y-2 w-full flex-1">
            <span className="font-medium">{label}</span>
            <div className="relative w-full">
                <select className="w-full outline-none p-2 border-[1px] border-gray-300 rounded-md appearance-none [&::-ms-expand]:hidden" {...props}>
                    {
                        options.map((option, index) => (
                            <option key={index} value={option.value}>
                                {option.label}
                            </option>
                        ))
                    }
                </select>
                <FaChevronDown className="size-3 absolute top-1/2 right-2 -translate-y-1/2 text-gray-400"/>
            </div>
        </div>
    )
}