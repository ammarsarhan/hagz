import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoChevronDown } from "react-icons/io5";
import { IoCheckmark } from "react-icons/io5";

interface MultiDropdownOption {
    value: string;
    label: string;
}

interface MultiDropdownProps {
    className?: string;
    error?: boolean;
    placeholder: string;
    value: string | string[];
    onChange: (value: string | string[]) => void;
    options: MultiDropdownOption[];
}

type MultiDropdownGroupProps = Omit<MultiDropdownProps, "error"> & { 
    label: string;
    error?: string;
    description?: string;
};

export default function MultiDropdown({ 
    className, 
    placeholder, 
    value, 
    error, 
    onChange,
    options
}: MultiDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const base = `p-2 border ${error ? "border-red-600" : "border-transparent"} rounded-md text-[0.85rem] w-full bg-gray-200/75 hover:bg-gray-200/50 outline-none focus:border-black focus:bg-gray-50 transition-colors cursor-pointer`;

    const selectedValues = Array.isArray(value) ? value : [];

    const getDisplayText = () => {
        const vals = selectedValues as string[];
        if (vals.length === 0) return placeholder;
        if (vals.length === 1) return options.find(o => o.value === vals[0])?.label ?? placeholder;
        return `${vals.length} selected`;
    };

    const isSelected = (optionValue: string) => (selectedValues as string[]).includes(optionValue);

    const handleSelect = (optionValue: string) => {
        const current = selectedValues as string[];
        const updated = current.includes(optionValue)
            ? current.filter(v => v !== optionValue)
            : [...current, optionValue];
        onChange(updated);
    };

    const hasSelection = (selectedValues as string[]).length > 0;

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
                className={`${base} flex items-center justify-between ${!hasSelection ? "text-gray-500" : ""}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{getDisplayText()}</span>
                <IoChevronDown 
                    className={`size-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-100 transition-colors ${
                                    isSelected(option.value) ? "bg-gray-50 font-medium" : ""
                                }`}
                                onClick={() => handleSelect(option.value)}
                            >
                                <span>{option.label}</span>
                                <span className={`size-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                                    isSelected(option.value)
                                        ? "bg-black border-black text-white"
                                        : "border-gray-300"
                                }`}>
                                    {isSelected(option.value) && <IoCheckmark className="size-3" />}
                                </span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function MultiDropdownGroup({ 
    className, 
    label, 
    placeholder, 
    value, 
    error, 
    description, 
    onChange,
    options,
}: MultiDropdownGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className}`}>
            <span className="text-sm">{label}</span>
            <MultiDropdown 
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