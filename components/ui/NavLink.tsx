"use client"

import { ReactNode } from "react"
import { usePathname } from 'next/navigation'
import Link from "next/link"

interface NavLinkProps {
    href: string,
    children?: ReactNode
}

export default function NavLink ({ href, children }: NavLinkProps) {
    const pathname = usePathname()

    return <Link className={`link ${pathname === href ? 'active' : ''}`} href={href}>{children}</Link>
}