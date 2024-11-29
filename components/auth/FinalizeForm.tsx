"use client";

import Button from "@/components/ui/Button";
import { useOwnerFormContext } from "@/context/useOwnerFormContext";
import { useEffect } from "react";
import Link from "next/link";
import Cookies from "js-cookie";

export default function Finalize() {
    const context = useOwnerFormContext();
    
    useEffect(() => {
        Cookies.remove("creationToken");
    }, [])
    
    useEffect(() => {
        context.actions.setRenderNext(false);
        context.actions.setRenderBack(false);
    }, [context.actions]);

    return (
        <Button variant="color" className="!px-20 mt-2" type="button">
            <Link href={"/dashboard"}>
                Go to dashboard
            </Link>
        </Button>
    );
}