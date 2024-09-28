type LabelCardProps = {
    title: string, 
    value: string,
    variant: 'positive' | 'negative' | 'neutral'
}

export default function LabelCardGroup ({cards} : {cards: LabelCardProps[]}) {
    return (
        <div className="flex flex-col gap-4">
            {
                cards.map((item, index) => {
                    return <LabelCard key={index} title={item.title} value={item.value} variant={item.variant}/>
                })
            }
        </div>
    )
}

export function LabelCard ({title, value, variant} : LabelCardProps) {
    switch (variant) {
        case 'positive':
            return (
                <div className="flex justify-between gap-24 p-5 border-[1px] rounded-xl text-sm">
                    <span className="text-dark-gray">{title}</span>
                    <span className="text-primary-green">{value}</span>
                </div>
            )
        case 'negative':
            return (
                <div className="flex justify-between gap-24 p-5 border-[1px] rounded-xl text-sm">
                    <span className="text-dark-gray">{title}</span>
                    <span className="text-red-500">{value}</span>
                </div>
            )
        case 'neutral':
            return (
                <div className="flex justify-between gap-24 p-5 border-[1px] rounded-xl text-sm">
                    <span className="text-dark-gray">{title}</span>
                    <span>{value}</span>
                </div>
            )
    }
}