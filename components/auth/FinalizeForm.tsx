"use client";

import Button from "@/components/ui/Button";
import { useFormContext } from "@/context/useFormContext";
import Link from "next/link";
import { useEffect } from "react";

export default function Finalize() {
    const context = useFormContext();
    
    useEffect(() => {
        context.actions.setRenderNext(false);
        context.actions.setRenderBack(false);
    }, [])

    return (
        <Button variant="color" className="!px-20 mt-2" type="button">
            <Link href={"/dashboard"}>
                Go to dashboard
            </Link>
        </Button>
    );
}