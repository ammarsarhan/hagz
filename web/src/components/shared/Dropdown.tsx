import { useState, useRef, useEffect, type ReactNode } from "react";
import { TbCheck, TbChevronDown } from "react-icons/tb";
 
export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface DropdownGroup {
  label?: string;
  options: DropdownOption[];
}

const baseField =
  "w-full text-base bg-white border px-2 py-1.5 rounded-md cursor-pointer select-none flex items-center justify-between gap-2";
 
function fieldClass(open: boolean, error?: string) {
  const border = error
    ? "border-red-500 outline-none"
    : open
    ? "border-primary-muted outline outline-2 outline-primary-muted"
    : "border-gray-200 outline-none";
  return `${baseField} ${border}`;
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    return () => document.removeEventListener("mousedown", onMouse);
  }, []);
 
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
 
  return { open, setOpen, ref };
}

interface DropdownProps {
  groups?: DropdownGroup[];
  options?: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
}
 
export default function Dropdown({
  groups,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className,
  label,
  error,
}: DropdownProps) {
  const { open, setOpen, ref } = useDropdown();

  const resolvedGroups: DropdownGroup[] = groups ?? [{ options: options ?? [] }];
  const allOptions = resolvedGroups.flatMap((g) => g.options);
  const selected = allOptions.find((o) => o.value === value);
 
  return (
    <div className={`flex flex-col gap-y-1.5 ${className ?? ""}`}>
      {label && <span className="text-base">{label}</span>}
      <div className="relative" ref={ref}>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={0}
          className={fieldClass(open, error)}
          onClick={() => setOpen((p) => !p)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((p) => !p);
            }
          }}
        >
          <span className="flex items-center gap-2 truncate">
            {selected?.icon && (
              <span className="text-gray-500 shrink-0">{selected.icon}</span>
            )}
            <span className={selected ? "text-gray-900" : "text-gray-400"}>
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <TbChevronDown
            size={16}
            className={`shrink-0 text-gray-400 transition-transform duration-200 ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
        {open && (
          <ul
            role="listbox"
            className="absolute z-50 top-full mt-1 left-0 w-full bg-white border border-gray-200 rounded-md shadow-md overflow-hidden py-1"
          >
            {resolvedGroups.map((group, gi) => (
              <li key={gi}>
                {gi > 0 && (
                  <div className="my-1 border-t border-gray-100" />
                )}
                {group.label && (
                  <div className="px-2 py-1 text-xs text-gray-400 tracking-wide select-none">
                    {group.label}
                  </div>
                )}
                <ul>
                  {group.options.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm transition-colors ${
                          isSelected
                            ? "bg-gray-50 text-black"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                      >
                        {opt.icon && (
                          <span className="shrink-0 text-gray-500">{opt.icon}</span>
                        )}
                        <span className="flex-1 truncate">{opt.label}</span>
                        {isSelected && (
                          <TbCheck size={14} className="shrink-0 text-black" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}