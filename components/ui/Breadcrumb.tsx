'use client'

import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface BreadcrumbProps {}

export default function Breadcrumb ({} : BreadcrumbProps) {
    return (
        <div className="flex items-center gap-x-2 text-xs sm:text-sm mb-6">
            <Link href="/">
                <span className="hover:underline">Home</span>
            </Link>
            <ArrowRight className="w-3 h-3"/>
            <Link href="/search">
                <span className="hover:underline">Search</span>
            </Link>
            <ArrowRight className="w-3 h-3"/>
            <Link href="/details/some-random-pitch-id">
                <span className="text-primary-green hover:underline">Details</span>
            </Link>
        </div>
    )
}