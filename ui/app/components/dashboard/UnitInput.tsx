import { useState, useRef, useEffect, SyntheticEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IoChevronDown } from "react-icons/io5";

interface DropdownOption {
    value: string;
    label: string;
}

interface UnitInputProps {
    className?: string;
    error?: boolean;
    placeholder: string;
    value: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    unit: string;
    onUnitChange: (unit: string) => void;
    unitOptions: DropdownOption[];
    readOnly?: boolean;
}

type UnitInputGroupProps = Omit<UnitInputProps, "error"> & {
    label: string;
    error?: string;
    description?: string;
};

const UNIT_WIDTH = "7.75rem";

function InlineUnitDropdown({
    value,
    onChange,
    options,
    error,
}: {
    value: string;
    onChange: (v: string) => void;
    options: DropdownOption[];
    error?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const selected = options.find(o => o.value === value);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const handleToggle = (e: SyntheticEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
    };

    return (
        <div ref={ref} className="relative h-full flex items-center" style={{ width: UNIT_WIDTH }}>
            <button
                type="button"
                onClick={handleToggle}
                className={`
                    h-[calc(100%-6px)] mx-0.75 pl-4 pr-3 w-full
                    flex items-center justify-between gap-1.5 rounded
                    bg-gray-800/90 hover:bg-gray-800/80 transition-colors
                    text-[0.78rem] font-medium whitespace-nowrap
                    ${error ? "text-red-400" : "text-white"}
                    focus:outline-none
                    rounded-full
                `}
            >
                <span className="truncate">{selected?.label ?? "—"}</span>
                <IoChevronDown
                    className={`size-3 text-white shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.13 }}
                        className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg w-max overflow-hidden"
                    >
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-[0.78rem] hover:bg-gray-100 transition-colors whitespace-nowrap ${opt.value === value ? "bg-gray-50 font-semibold" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function UnitInput({
    className,
    error,
    placeholder,
    value,
    onChange,
    unit,
    onUnitChange,
    unitOptions,
    readOnly = false,
}: UnitInputProps) {
    const base = `p-2 border ${error ? "border-red-600" : "border-transparent"} rounded-md text-[0.85rem] w-full bg-gray-200/75 hover:bg-gray-200/50 outline-none focus:border-black focus:bg-gray-50 transition-colors ${readOnly ? "opacity-60 cursor-not-allowed" : ""}`;

    return (
        <div className={`relative ${className ?? ""}`}>
            <input
                className={base}
                style={{ paddingRight: `calc(${UNIT_WIDTH} + 0.25rem)` }}
                type="number"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                min="0"
            />
            <div
                className="absolute inset-y-0 right-0 flex items-center pointer-events-auto"
                style={{ width: UNIT_WIDTH }}
            >
                <InlineUnitDropdown
                    value={unit}
                    onChange={onUnitChange}
                    options={unitOptions}
                    error={error}
                />
            </div>
        </div>
    );
}

export function UnitInputGroup({
    className,
    label,
    placeholder,
    value,
    onChange,
    error,
    description,
    unit,
    onUnitChange,
    unitOptions,
    readOnly,
}: UnitInputGroupProps) {
    return (
        <div className={`flex flex-col gap-y-1.5 ${className ?? ""}`}>
            <span className="text-sm">{label}</span>
            <UnitInput
                error={!!error}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                unit={unit}
                onUnitChange={onUnitChange}
                unitOptions={unitOptions}
                readOnly={readOnly}
            />
            <AnimatePresence mode="wait">
                {error ? (
                    <motion.span
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-red-600"
                    >
                        {error}
                    </motion.span>
                ) : description ? (
                    <motion.span
                        key="desc"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-600"
                    >
                        {description}
                    </motion.span>
                ) : null}
            </AnimatePresence>
        </div>
    );
}