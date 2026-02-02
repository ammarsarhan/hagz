import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoChevronDown } from "react-icons/io5";

interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps {
    className?: string;
    error?: boolean;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    options: DropdownOption[];
}

type DropdownGroupProps = Omit<DropdownProps, "error"> & { 
    label: string;
    error?: string;
    description?: string;
};

export default function Dropdown({ 
    className, 
    placeholder, 
    value, 
    error, 
    onChange,
    options 
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const base = `p-2 border ${error ? "border-red-600" : "border-transparent"} rounded-md text-[0.85rem] w-full bg-gray-200/75 hover:bg-gray-200/50 outline-none focus:border-black focus:bg-gray-50 transition-colors cursor-pointer`;
    
    const selectedOption = options.find(opt => opt.value === value);
    const displayText = selectedOption ? selectedOption.label : placeholder;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                className={`${base} flex items-center justify-between ${!selectedOption ? "text-gray-500" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{displayText}</span>
                <IoChevronDown 
                    className={`size-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                                    option.value === value ? "bg-gray-50 font-medium" : ""
                                }`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function DropdownGroup({ 
    className, 
    label, 
    placeholder, 
    value, 
    error, 
    description, 
    onChange,
    options 
}: DropdownGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className}`}>
            <span className="text-sm">{label}</span>
            <Dropdown 
                error={!!error}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                options={options}
            />
            <AnimatePresence mode="wait">   
                {
                    error ?
                    <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-600"
                    >
                        {error}
                    </motion.span> :
                    description &&
                    <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-600"
                    >
                        {description}
                    </motion.span>              
                }
            </AnimatePresence>
        </div>
    );
}