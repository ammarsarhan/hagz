export default function SchemaCard () {
    return (
        <div className="inline-flex flex-col text-sm p-5 border-[1px] rounded-xl w-fit">
            <div className="flex justify-between mb-6">
                <span className="font-medium">Plan</span>
                <button className="flex items-center gap-1">
                    <span>Edit</span>
                </button>
            </div>
            <div className="flex flex-wrap gap-x-28 gap-y-6 sm:gap-y-8">
                <div className="flex flex-col gap-4 sm:gap-6">
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                </div>
                <div className="flex flex-col gap-4 sm:gap-6">
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-dark-gray">Price (per hour)</span>
                        <span>EGP 300.00</span>
                    </div>
                </div>
            </div>
        </div>
    )
}