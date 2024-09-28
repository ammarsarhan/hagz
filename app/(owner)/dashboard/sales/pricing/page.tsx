import SchemaCard from "@/components/dashboard/SchemaCard"

export default function Pricing () {
    return (
        <>
            <div className='my-4'>
                <span className='font-medium text-xl'>Pricing Schemas</span>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Your Current Active Plan</span>
                <SchemaCard/>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Inactive Plans</span>
                <div className="overflow-x-scroll whitespace-nowrap [&>div]:mx-5 [&>*:first-child]:ml-0 [&>*:last-child]:mr-0">
                    <SchemaCard/>
                    <SchemaCard/>
                    <SchemaCard/>
                    <SchemaCard/>
                    <SchemaCard/>
                </div>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Discounting</span>
                
            </div>
        </>
    )
}