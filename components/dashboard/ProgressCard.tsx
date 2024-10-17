interface ProgressCardProps {
    title: string
    value: string
}

export default function ProgressCard ({title, value} : ProgressCardProps) {
    return (
        <div className="flex flex-col gap-7 p-5 border-[1px] rounded-md text-sm w-96">
        <span className="text-dark-gray">{title}</span>
        <div className="flex-center relative h-72">
            <div className="absolute h-72 w-72 rounded-full border-8 border-gray-100"></div>
            <div className="absolute h-72 w-72 rounded-full border-8 border-primary-green"></div>
            <span className="block text-4xl font-medium">{value}</span>
        </div>
    </div>
    )
}