import Link from "next/link";

export function UserNavigation() {
    return (
        <nav className="px-6 py-4 flex items-center justify-between border-b-[1px]">
            <div>
                <Link href={"/"}>
                    <span className="font-semibold">Hagz</span>
                </Link>
            </div>
            <div>
                links
            </div>
            <div>
                
            </div>
        </nav>
    )
}