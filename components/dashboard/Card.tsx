interface CardProps {
    title: string;
    value?: number;
    currency?: number;
    percentage?: number;
}

export default function Card ({title, value, currency, percentage}: CardProps) {
    let percentageFormat: string = "";
    let percentageStyle: string = "";

    let currencyFormat = currency && new Intl.NumberFormat('en-US', {style: 'currency', currency: 'EGP'}).format(currency);

    if (percentage && percentage > 0) {
        percentageFormat = `+${percentage.toFixed(1)}%`;
        percentageStyle = "text-green-700";
    } else if (percentage && percentage < 0) {
        percentageFormat = `${percentage.toFixed(1)}%`;
        percentageStyle = "text-red-500";
    } else if (percentage === 0) {
        percentageFormat = `+${percentage.toFixed(1)}%`;
        percentageStyle = "text-yellow-500";
    }

    if (currency) {
        return (
            <div className="flex flex-col gap-3 py-5 pl-5 pr-20 border-[1px] rounded-xl text-sm">
                <span className="text-dark-gray">{title}</span>
                <div>
                    <span className="block text-lg font-medium">{currencyFormat}</span>
                    { 
                    percentage &&
                    <span className="block text-dark-gray">
                        <span className={`${percentageStyle}`}>{percentageFormat}</span> vs last month
                    </span>
                    }
                </div>
            </div>
        )
    }
    if (value) {
        return (
            <div className="flex flex-col gap-3 py-5 pl-5 pr-20 border-[1px] rounded-xl text-sm">
                <span className="text-dark-gray">{title}</span>
                <div>
                    <span className="block text-lg font-medium">{value}</span>
                    { 
                    percentage &&
                    <span className="block text-dark-gray">
                        <span className={`${percentageStyle}`}>{percentageFormat}</span> vs last month
                    </span>
                    }
                </div>
            </div>
        )
    }
}