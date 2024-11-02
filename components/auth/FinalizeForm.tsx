"use client";

import Button from "@/components/ui/Button";
import Link from "next/link";

export default function Finalize() {
    return (
        <Button variant="color" className="!px-20 mt-2" type="button">
            <Link href={"/dashboard"}>
                Go to dashboard
            </Link>
        </Button>
    );
}