import { Edit } from "lucide-react"

interface SchemaCardProps {
    active: boolean
}

export default function SchemaCard ({active = true} : SchemaCardProps) {
    if (active) {
        return (
            <div className="inline-flex flex-col text-sm p-5 border-[1px] rounded-xl w-fit">
                <div className="flex justify-between mb-6">
                    <span className="font-medium">Plan A</span>
                </div>
                <div className="flex flex-wrap gap-x-28 gap-y-4">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="flex flex-col">
                            <span className="text-dark-gray">Price (per hour)</span>
                            <span>EGP 300.00</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-dark-gray">Deposit</span>
                            <span>Yes</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-dark-gray">Deposit Value</span>
                            <span>EGP 150.00</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="flex flex-col">
                            <span className="text-dark-gray">Discount</span>
                            <span>EGP 0.00</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-dark-gray">Total</span>
                            <span>EGP 310.00</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative inline-flex flex-col text-sm p-5 border-[1px] rounded-xl w-fit">
            <div className="flex justify-between mb-6">
                <span className="font-medium">Plan B</span>
                <button className="flex items-center gap-1">
                    <Edit className="w-4 h-4 text-dark-gray"/>
                </button>
            </div>
            <div className="flex flex-wrap gap-x-28 gap-y-4">
                <div className="flex flex-col gap-4 sm:gap-6">
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Deposit</span>
                        <span>Yes</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Deposit Value</span>
                        <span>EGP 150.00</span>
                    </div>
                </div>
                <div className="flex flex-col gap-4 sm:gap-6">
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Discount</span>
                        <span>EGP 0.00</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Total</span>
                        <span>EGP 310.00</span>
                    </div>
                </div>
            </div>
        </div>
    )
}