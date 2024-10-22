import { ReactNode } from "react"

interface IndicatorProps { title: string, description: string, image: ReactNode, active?: boolean };

export default function Indicator ({title, description, image, active = false} : IndicatorProps) {
    if (!active) {
        return (
            <div className="flex gap-x-4 items-center text-sm text-dark-gray">
                {image}
                <div className="flex flex-col">
                    <span className="font-medium">{title}</span>
                    <span>{description}</span>
                </div>
            </div>
        )
    }
    return (
        <div className="flex gap-x-4 items-center text-sm">
            {image}
            <div className="flex flex-col">
                <span className="font-medium">{title}</span>
                <span className="text-gray-700">{description}</span>
            </div>
        </div>
    )
}