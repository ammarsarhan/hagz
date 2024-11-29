"use client";

import { ChevronsUpDown, CheckCircle2, CirclePlus, X} from "lucide-react"
import { ReactNode, useState } from "react"
import Button from "@/components/ui/Button";
import Link from "next/link";

interface SelectorOption {
    value: string
    description: string
    icon: ReactNode
}

interface SelectorModalProps {
    active: number
    options: SelectorOption[]
    handleSelect: (index: number) => void
    handleClose: () => void
}

interface SelectorTriggerProps {
    option: SelectorOption
    chevrons: boolean
    onClick: () => void
    onSelect?: (index: number) => void
    active?: boolean
    className?: string
    gap?: number
}

export function SelectorModal ({active, options, handleSelect, handleClose} : SelectorModalProps) {
    const onSelect = (index: number) => {
        handleSelect(index);
        handleClose();
    }

    return (
        <div className="h-screen w-full flex-center fixed z-50 bg-black bg-opacity-10">
            <div className="flex flex-col gap-y-2 rounded-md bg-white p-6 w-96">
                <div className="flex items-start justify-between mt-1 mb-3">
                    <span className="text-sm">Your Pitches ({options.length})</span>
                    <button onClick={handleClose}>
                        <X className="w-4 h-4 text-black hover:text-gray-500 transition-colors"/>
                    </button>
                </div>
                <div className="flex flex-col gap-y-2 h-60 overflow-y-scroll border-t-[1px] py-2">
                    {
                        options.map((el, index) => {
                            return (
                                <SelectorTrigger 
                                    option={el}
                                    chevrons={false}
                                    active={index === active}
                                    onClick={() => onSelect(index)}
                                    key={index}
                                />
                            )
                        })
                    }
                    <Link className="flex items-center justify-between gap-4 cursor-pointer px-4 py-3 text-sm transition-color rounded-md hover:bg-gray-50" href={"/dashboard/pitch/add"}>
                        <div className="flex items-center gap-x-2">
                            <button>
                                <CirclePlus className="w-4 h-4"/>
                            </button>
                            <div className="flex flex-col gap-[0.15rem]">
                                <span className="text-primary-black text-sm">Add Pitch</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function SelectorTrigger ({option, chevrons, active = false, className = "", gap = 4, onClick} : SelectorTriggerProps) {
    return (
        <div className={`flex items-center justify-between gap-4 cursor-pointer px-4 py-3 text-sm transition-color rounded-md ${className} ${active ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`} onClick={onClick}>
            <div className={`flex items-center gap-x-${gap}`}>
                {
                    chevrons &&
                    <div className="flex-center w-5 h-5 rounded-md">
                        {option.icon}
                    </div>
                }
                <div className="flex flex-col gap-[0.15rem]">
                    <span className="text-primary-black font-medium">{option.value}</span>
                    {
                        option.description && 
                        <span className="text-dark-gray text-xs">{option.description}</span>
                    }
                </div>
            </div>
            {
                chevrons && <ChevronsUpDown className="w-4 h-4"/>
            }
            {
                active && <CheckCircle2 className="w-4 h-4 text-primary-green"/>
            }
        </div>
    )
}