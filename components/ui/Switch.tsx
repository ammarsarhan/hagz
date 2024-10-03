interface SwitchProps {
    options: string[],
    active: number
}

export default function Switch ({options, active} : SwitchProps) {
    return (
        <div className="flex items-center justify-between border-[1px] rounded-lg bg-gray-100 text-sm">
            {
                options.map((option, index) => {
                    if (index == active) {
                        return <button key={index} className="w-20 flex-center py-3 rounded-lg bg-white text-blue-600 font-semibold">{option}</button>
                    }
                    
                    return <button key={index} className="w-20 flex-center py-3">{option}</button>
                })
            }
        </div>
    )
}
