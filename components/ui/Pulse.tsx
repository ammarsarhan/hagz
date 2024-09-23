export default function Pulse ({variant} : {variant: 'positive' | 'negative' | 'unknown' | 'inactive'}) {
    switch (variant) {
        case 'positive':
            return (
                <div className="flex items-center gap-x-4">
                    <div className="rounded-full w-2 h-2 bg-tertiary-green pulse-green"></div>
                    <span className="text-sm">Date is available</span>
                </div>
            )
        case 'negative':
            return (
                <div className="flex items-center gap-x-4">
                    <div className="rounded-full w-2 h-2 bg-red-700 pulse-red"></div>
                    <span className="text-sm">Date is not available</span>
                </div>
            )
        case 'unknown':
            return (
                <div className="flex items-center gap-x-4">
                    <div className="rounded-full w-2 h-2 bg-yellow-500 pulse-yellow"></div>
                    <span className="text-sm">Issue getting information</span>
                </div>
            )
        case 'inactive':
            return (
                <div className="flex items-center gap-x-4">
                    <div className="rounded-full w-2 h-2 bg-black pulse-gray"></div>
                    <span className="text-sm">Select date to check availability</span>
                </div>
            )
    }
}