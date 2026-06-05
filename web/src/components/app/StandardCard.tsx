import { cloneElement, type ReactElement } from "react";
import type { IconBaseProps } from "react-icons";
import { TbArrowRight } from "react-icons/tb";

export default function StandardCard({ icon, title, description, link } : { icon: ReactElement<IconBaseProps>, title: string, description: string, link?: string }) {
    return (
        <div className='flex flex-col items-start justify-between bg-gray-50 rounded-md border border-gray-200 p-4'>
            <div className='size-8 flex-center bg-white rounded-md border border-gray-200'>
                {cloneElement(icon, { className: "size-5" })}
            </div>
            <div className='flex flex-col gap-y-0.5'>
                <span className='font-medium text-base'>{title}</span>
                <p className='text-gray-500 text-[0.8125rem]'>{description}</p>
                {
                    link &&
                    <a href={link} className="w-fit text-[0.8125rem] flex items-center gap-x-1.5 mt-2 group text-primary-muted">Learn how <TbArrowRight className="rotate-0 group-hover:-rotate-45 transition-all"/></a>
                }
            </div>
        </div>
    )
}