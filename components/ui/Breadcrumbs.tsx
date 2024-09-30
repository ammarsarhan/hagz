'use client'

import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbsProps {
    className?: string,
    labels: {
        label: string, 
        href: string
    }[]
}

export default function Breadcrumbs({labels, className} : BreadcrumbsProps) {
    return (
        <div className={`flex items-center gap-x-2 text-xs sm:text-sm ${className}`}>
            {
                labels.map((item, index) => {
                    if (index == labels.length - 1) {
                        return (
                            <Link href={item.href} key={index}>
                                <span className="hover:underline text-primary-green">{item.label}</span>
                            </Link>
                        )
                    }

                    return (
                        <>
                            <Link href={item.href} key={index}>
                                <span className="hover:underline">{item.label}</span>
                            </Link>
                            <ChevronRight className="w-4 h-4"/>
                        </>
                    )
                })
            }
        </div>
    )
}