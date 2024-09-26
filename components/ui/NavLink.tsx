"use client"

import { ReactNode } from "react"
import { usePathname } from 'next/navigation'
import Link from "next/link"

interface NavLinkProps {
    href: string,
    className?: string,
    children?: ReactNode
}

export default function NavLink ({ href, className = "", children }: NavLinkProps) {
    const pathname = usePathname();
    const styles = `link ${pathname === href ? 'active ' : ''}${className}`;

    return <Link className={styles.trim()} href={href}>{children}</Link>
}