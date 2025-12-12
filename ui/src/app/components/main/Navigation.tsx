"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAvatarColor } from "@/app/utils/color";
import { BiSearch } from "react-icons/bi";
import { FaCheck, FaChevronDown, FaChevronRight, FaLocationDot } from "react-icons/fa6";

type Opt = { value: string; label: string };

interface LocationPickerProps {
    options: Opt[];
    value: string;
    onChange?: ((e: React.ChangeEvent<HTMLSelectElement>) => void);
}

const LocationPicker = ({ options, value, onChange } : LocationPickerProps) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selected = options.find((opt) => opt.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="w-full text-[0.8125rem]" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className={`cursor-pointer w-full rounded-r-full py-2 pl-2 pr-3 flex justify-between items-center text-left`}
            >
                <div className="flex items-center gap-x-2 px-1">
                    <FaLocationDot className="size-3.5"/>
                    <span className="truncate">
                        {selected?.label || "Select a location"}
                    </span>
                </div>
                <FaChevronDown
                    className={`text-gray-500 size-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {
                open &&
                (
                    <div className="absolute mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto z-50">
                        {
                        options.length > 0 ? (
                            options.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => {
                                        // call the helper which will call the provided onChange appropriately
                                        const syntheticEvent = {
                                        target: { value: opt.value },
                                        } as unknown as React.ChangeEvent<HTMLSelectElement>;

                                        onChange?.(syntheticEvent);
                                        setOpen(false);
                                    }}
                                    className={`cursor-pointer px-3 py-2 flex justify-between items-center hover:bg-gray-100 ${opt.value === value ? "bg-gray-50" : ""}`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.value === value && <FaCheck className="text-blue-500 size-3" />}
                                </div>
                            ))
                        ) : (
                            <div className="p-2 text-gray-500">No options</div>
                        )}
                    </div>
                )
            }
        </div>
    )
}

const Search = () => {
    const [location, setLocation] = useState("ALEXANDRIA");

    return (
        <div className="border-[1px] border-gray-200 flex rounded-full overflow-clip">
            <div className="w-72 flex-1 relative border-r-[1px] border-gray-200">
                <BiSearch className="size-3.5 text-gray-500 absolute top-1/2 left-3.5 -translate-y-1/2"/>
                <input type="text" placeholder="Pitches, fields, grounds..." className="text-[0.8125rem] py-2 pl-8.5 pr-4 rounded-full w-full outline-none" />
            </div>  
            <div className="w-72 flex-1 overflow-clip">
                <LocationPicker
                    options={[
                        { label: "Alexandria, Egypt", value: "ALEXANDRIA" },
                        { label: "Cairo, Egypt", value: "CAIRO" }
                    ]}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
            </div>
        </div>
    )
}

interface AvatarProps {
    firstName: string;
}

const Avatar = ({ firstName } : AvatarProps) => {
    const color = getAvatarColor(firstName);
    const label = firstName[0].toUpperCase()

    return (
        <Link href="/account" className="flex items-center gap-x-2 group cursor-pointer">
            <div className={`cursor-pointer size-8 rounded-full flex items-center justify-center ${color} group-hover:${color}/50 transition-colors`}>
                <span className="text-sm text-white">{label}</span>
            </div>
            <FaChevronDown className="size-2.5 text-gray-500"/>
        </Link>
    )
}

const AvatarPlaceholder = () => {
    return (
        <Link href="/auth/sign-up" className="px-5 py-3 rounded-full bg-blue-800 hover:bg-blue-800/90 transition-colors text-white flex items-center gap-x-2">
            <span className="text-xs">Try for free</span>
        </Link>
    )
}

interface UserData {
    firstName: string;
    lastName: string;
    role: "USER" | "MANAGER" | "OWNER";
    status: "UNVERIFIED" | "ACTIVE";
    email: string;
}

export default function Navigation({ user } : { user: UserData | null }) {
    return (
        <nav className="flex items-center justify-between h-16 py-4 px-6 border-b-[1px] border-gray-200 z-10 text-[0.8125rem]">
            <div className="flex gap-x-6 items-center">
                <Link href="/" className="font-semibold text-base">Hagz</Link>
                <div className="flex items-center gap-x-2">
                    <Search/>
                    <button className="py-3 px-5 flex items-center justify-center gap-x-1.5 rounded-full bg-black hover:bg-black/80 cursor-pointer text-white">
                        <BiSearch className="size-3.25"/>
                        <span className="text-xs">Search</span>
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-x-8">
                <div className="flex items-center gap-x-6">
                    <Link href="/search" className="hover:underline">Search</Link>
                    <Link href="/faq" className="hover:underline">How It Works</Link>
                    <Link href="/contact" className="hover:underline">Contact Us</Link>
                    {
                        user ?
                        user.role === "USER" ? 
                        <Link href="/bookings" className="hover:underline">Bookings</Link> :
                        <Link href="/dashboard" className="hover:underline">Dashboard</Link> :
                        <></>
                    }
                </div>
                {
                    user ? 
                    <Avatar firstName={user.firstName}/> :
                    <AvatarPlaceholder/>
                }
            </div>
        </nav>
    )
}
