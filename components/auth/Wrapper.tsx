import { ReactNode } from "react"
import Button from "@/components/ui/Button"

interface WrapperProps {
    children: ReactNode,
    title: string,
    subtitle: string,
    index: number,
    lastIndex: number,
    next: () => void,
    back: () => void
}

export default function Wrapper ({children, title, subtitle, index, lastIndex, next, back} : WrapperProps) {
    return (
        <div className="w-full h-full flex-center flex-col gap-y-4 lg:bg-white">
            <div className="flex-center flex-col gap-y-1 text-center w-4/5">
                <h1 className="text-2xl font-medium">{title}</h1>
                <h6 className="text-sm text-dark-gray">{subtitle}</h6>
            </div>
            {children}
            <div className="flex gap-x-4">
                {
                    index != 0 && <Button variant="primary" className="px-20" onClick={back} type="button">Back</Button>
                }
                <Button variant="color" className="px-20" type="submit">{index == lastIndex ? "Finish" : "Next"}</Button>
            </div>
        </div>
    )
}