import Table from '@/components/ui/Table';
import Card from '@/components/dashboard/Card';
import ProgressCard from '@/components/dashboard/ProgressCard';
import LabelCardGroup from '@/components/dashboard/LabelCard';

import getDate, { getDayName } from '@/utils/date';

export default function Sales () {
    return (
        <>        
            <div className='flex items-center gap-4'>
                <div className='w-8 h-8 bg-black rounded-full'></div>
                <div className='flex flex-col gap-1 my-4'>
                    <span className='font-semibold text-xl'>Your sales progess, Ammar</span>
                    <span className='text-dark-gray text-sm'>As of: {getDayName()} - {getDate()}</span>
                </div>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Overview</span>
                <div className='flex flex-wrap items-center gap-4'>
                    <Card title="Profit" currency={4000.00} percentage={2.5}/>
                    <Card title="Reservations" value={67} percentage={10}/>
                    <Card title="Avg Reservation Time" value={1.4} percentage={1.25}/>
                </div>
            </div>
            <div className='flex flex-wrap items-start gap-4 my-2'>
                <div className='flex flex-col gap-4 my-2'>
                    <span className='text-sm text-dark-gray'>Timing</span>
                    <ProgressCard title="Avg number of hours reserved per day" value="10 Hrs"/>
                </div>
                <div className='flex flex-col gap-4 my-2'>
                    <span className='text-sm text-dark-gray'>Statistics</span>
                    <LabelCardGroup cards={[{title: "Overall feedback by users", value: "+50%", variant: "positive"}, {title: "Recurring users", value: "23", variant: "positive"}, {title: "Hours reserved", value: "300", variant: "neutral"}, {title: "Reservation retention", value: "-4%", variant: "negative"}]}/>
                </div>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Best Performing Reservations</span>
                <Table headers={["Reservation No.", "Date", "Time (in hours)", "Profit"]} data={[["#1364537595", "12-10-2024", "3", "EGP 400.00"], ["#8322646247", "8-12-2022", "4", "EGP 850.00"], ["#7586462724", "27-4-2023", "7", "EGP 1000.00"], ["#1364537595", "12-10-2024", "3", "EGP 400.00"], ["#8322646247", "8-12-2022", "4", "EGP 850.00"]]}/>
            </div>
        </>
    )
}