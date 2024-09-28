"use client";

import { useState, useEffect } from "react"
import SchemaCard from "@/components/dashboard/SchemaCard"
import Button from "@/components/ui/Button"

import getCurrencyFormat from "@/utils/currency";

export default function Pricing () {
    const [isDepositChecked, setIsDepositChecked] = useState(false);
    const [isDiscountChecked, setIsDiscountChecked] = useState(false);

    const [deposit, setDeposit] = useState(0)
    const [discount, setDiscount] = useState(0);

    const [total, setTotal] = useState(0);

    const priceFormat = getCurrencyFormat(total);
    const totalFormat = isDiscountChecked ? getCurrencyFormat(total - discount + 10) : getCurrencyFormat(total + 10);

    return (
        <>
            <div className='my-4'>
                <span className='font-medium text-xl'>Pricing Schemas</span>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Your Current Active Plan</span>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
                    <SchemaCard active/>
                </div>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Inactive Plans</span>
                <div className="overflow-x-scroll whitespace-nowrap [&>div]:mx-5 [&>*:first-child]:ml-0 [&>*:last-child]:mr-0">
                    {Array(5).fill(<SchemaCard active={false}/>)}
                </div>
            </div>
            <div className='flex flex-col gap-4 my-2'>
                <span className='text-sm text-dark-gray'>Add Plan</span>
                <form action="" className="flex flex-col gap-4 md:max-w-[50%]">
                    <div className="text-sm">
                        <span className="block">Price</span>
                        <input type="text" placeholder="Price" className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => setTotal(Number(e.target.value))}/>
                    </div>
                    <div className="text-sm flex items-center flex-wrap gap-x-10 gap-y-2">
                        <div className="flex items-center gap-2">
                            <span className="block">Set Deposit?</span>
                            <input type="checkbox" name="Deposit" disabled={total <= 0} checked={isDepositChecked} onChange={() => setIsDepositChecked(!isDepositChecked)}/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="block">Add Discount?</span>
                            <input type="checkbox" name="Discount" disabled={total <= 0} checked={isDiscountChecked} onChange={() => setIsDiscountChecked(!isDiscountChecked)}/>
                        </div>
                    </div>
                    <div className="text-sm flex flex-col gap-4">
                        {
                            isDepositChecked &&
                            <div>
                                <span className="block">Deposit</span>
                                <input type="text" placeholder="Deposit Value" value={deposit} className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => setDeposit(Number(e.target.value))}/>
                            </div>
                        }
                        {
                            isDiscountChecked &&
                            <div>
                                <span className="block">Discount</span>
                                <input type="text" placeholder="Discount Value" value={discount} className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => {setDiscount(Number(e.target.value))}}/>
                            </div>
                        }
                    </div>
                    <div className="flex flex-col gap-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span>Price</span>
                            <span>{isNaN(total) || isNaN(deposit) || isNaN(discount) ? "N/A" : priceFormat}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Service Fee</span>
                            <span>{isNaN(total) || isNaN(deposit) || isNaN(discount) ? "N/A" : "EGP 10.00"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Total (per hr)</span>
                            <span>{isNaN(total) || isNaN(deposit) || isNaN(discount) ? "N/A" : `${totalFormat} ${(isDiscountChecked && total <= 0) ? `(-${(discount/total * 100).toFixed(2)}%)` : ""}`}</span>
                        </div>
                    </div>
                    {
                        isDepositChecked &&
                        <div className="flex items-center justify-between text-sm text-dark-gray">
                            <span>To Be Collected</span>
                            <span>{getCurrencyFormat((total - discount + 10) - deposit)}</span>
                        </div>
                    }
                    <Button variant="disabled" className="my-4 py-[0.875rem]">Create Plan</Button>
                </form>
            </div>
        </>
    )
}