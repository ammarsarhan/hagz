import Link from "next/link"

export default function Copyright () {
    return (
        <div className="flex items-center justify-end gap-x-2 text-xs text-dark-gray mt-16">
            <span>© 2024 Hagz. All rights reserved.</span>
            <Link href="/privacy"><span className="hover:underline">Privacy Policy</span></Link>
            <Link href="/terms"><span className="hover:underline">Terms of Service</span></Link>
        </div>
    )
}