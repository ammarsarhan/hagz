import Breadcrumbs from "@/components/ui/Breadcrumbs"
import Selector from "@/components/dashboard/Selector"
import Link from "next/link"

import { getNextBillableWeek } from "@/utils/date"

import { Edit, CreditCard, CheckCircle2 } from "lucide-react"

export default function Billing () {
    return (
        <>
            <Breadcrumbs labels={[{label: "Sales", href: "/dashboard/sales"}, {label: "Billing", href: "/dashboard/sales/billing"}]} className="mt-4"/>
            <div className='mt-4 mb-2'>
                <span className='font-semibold text-xl block'>Billing Methods</span>
                <span className="text-dark-gray block text-sm mt-2">Update your billing methods or switch plans to recieve payments from your customers.</span>
            </div>
            <div className="text-sm my-4">
                <span className="block mb-4 text-dark-gray">Billing Information</span>
                <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                    <div className="flex flex-col flex-1 gap-y-3 w-full">
                        <span className="block">Method</span>
                        <div className="flex items-center justify-between gap-x-2">
                            <div className="w-72">
                                <Selector value="Credit Card" icon={<CreditCard className="w-4 h-4"/>} gap={3}/>
                            </div>
                            <CheckCircle2 className="w-[18px] h-[18px] text-green-700"/>
                        </div>
                        <div className="flex flex-col gap-y-5">
                             <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Card Holder</span>
                                <input readOnly type="text" placeholder="Card Holder" value={"Ammar Sarhan"} className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                             <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Credit/Debit Card Number</span>
                                <input readOnly type="text" placeholder="Card Number" value={"0000-1111-2222-3333"} className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-wrap gap-x-8 gap-y-5">
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Expiration Month & Year</span>
                                    <input readOnly type="text" placeholder="Expiration Date" value={"05/2027"} className="py-2 px-3 border-[1px] rounded-lg"/>
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">CVC</span>
                                    <input readOnly type="text" placeholder="Security Code" value={"737"} className="py-2 px-3 border-[1px] rounded-lg"/>
                                </div>
                            </div>
                        </div>
                        <p className="text-dark-gray mt-2">Note: You will not be able to recieve payments until your payment method has been verified. <Link href={"/faq"} className="text-blue-700 mt-1 hover:underline block w-fit">Learn more</Link></p>
                    </div>
                    <div className="flex flex-1 flex-col w-full">
                        <div className="flex items-center justify-between w-full mb-4">
                            <span>Address</span>
                            <button><Edit className="w-4 h-4 text-dark-gray"/></button>
                        </div>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-wrap gap-x-8">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-dark-gray">First Name</span>
                                    <span>Ammar</span>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-dark-gray">Last Name</span>
                                    <span>Sarhan</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-dark-gray">Apt/Building</span>
                                <span className="max-w-[calc(50%-2rem)]">Burj Al Nile, 11th Floor, 21st</span>
                            </div>
                            <div className="flex flex-wrap gap-x-8">
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-dark-gray">Street Addr 1</span>
                                    <span>4th Nasr Street, Green Plaza</span>
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <span className="text-dark-gray">Street Addr 2</span>
                                    <span>4th Hilton Street</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-dark-gray">City</span>
                                <span className="max-w-[calc(50%-2rem)]">Smouha</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-dark-gray">Governorate</span>
                                <span className="max-w-[calc(50%-2rem)]">Alexandria</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="text-sm my-4">
                <span className="text-dark-gray block">Next Scheduled Payment</span>
                <span className="block my-1">Your next payment is to be delivered on: {getNextBillableWeek()}.</span>
            </div>
        </>
    )
}