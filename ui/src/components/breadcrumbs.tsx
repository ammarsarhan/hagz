"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

export default function Breadcrumbs() {
    const path = usePathname();
    const blocks = path.split("/").filter(value => value != "");

    return (
        <div className="flex items-center gap-x-2 px-4 py-3 my-3 text-sm">
            {
                blocks.map((name, index) => {
                    const last = index === blocks.length - 1;
                    const label = name[0].toUpperCase() + name.slice(1);
                    let location = "/";

                    blocks.map((block, i) => {
                        if (i <= index) {
                            location += `${block}/`;
                        };
                    });

                    if (!last) {
                        return (
                            <Fragment key={index}>         
                                <Link href={location} className="text-gray-500 hover:underline">{label}</Link>
                                <span className="text-gray-500">/</span>
                            </Fragment>
                        )
                    }

                    return (    
                        <span key={index}>{label}</span>
                    )
                })
            }
        </div>
    )
}