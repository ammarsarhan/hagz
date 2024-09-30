"use client";

import { useState, useEffect } from "react"
import SchemaCard from "@/components/dashboard/SchemaCard"
import Button from "@/components/ui/Button"
import Breadcrumbs from "@/components/ui/Breadcrumbs"

import getCurrencyFormat from "@/utils/currency";

export default function Pricing () {
    const [isDepositChecked, setIsDepositChecked] = useState(false);
    const [isDiscountChecked, setIsDiscountChecked] = useState(false);

    const [deposit, setDeposit] = useState(0)
    const [discount, setDiscount] = useState(0);

    const [total, setTotal] = useState(0);

    const priceFormat = getCurrencyFormat(total);
    const totalFormat = isDiscountChecked ? getCurrencyFormat(total - discount + 10) : getCurrencyFormat(total + 10);

    const validateInputs = () => {
        if (isNaN(total) || isNaN(deposit) || isNaN(discount) || total <= 0) {
            return true;
        }

        if (isDepositChecked && deposit <= 0) {
            return true;
        }

        if (isDiscountChecked && discount <= 0) {
            return true;
        }

        return false;
    }

    useEffect(() => {
        if (total <= 0) {
            setIsDepositChecked(false);
            setIsDiscountChecked(false);
        }
    }, [total]);

    useEffect(() => {
        isDepositChecked == false && setDeposit(0);
    }, [isDepositChecked]);

    useEffect(() => {
        isDiscountChecked == false && setDiscount(0);
    }, [isDiscountChecked]);

    return (
        <>
            <Breadcrumbs labels={[{label: "Sales", href: "/dashboard/sales"}, {label: "Pricing", href: "/dashboard/sales/pricing"}]} className="mt-4"/>
            <div className='my-4'>
                <span className='font-semibold text-xl block'>Pricing Schemas</span>
                <span className="text-dark-gray block text-sm mt-2">Create, edit, add, or remove pricing plans for your customers.</span>
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
                <form action="" className="flex flex-col gap-4 md:max-w-[50%] border-[1px] p-5 rounded-xl">
                    <div className="text-sm">
                        <span className="block">Price*</span>
                        <input type="text" placeholder="Price" className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => setTotal(Number(e.target.value))}/>
                    </div>
                    <div className="text-sm flex items-center flex-wrap gap-x-10 gap-y-2">
                        <div className="flex items-center gap-2">
                            <span className="block">Set Deposit?</span>
                            <input type="checkbox" name="Deposit" disabled={total <= 0 || isNaN(total)} checked={isDepositChecked} onChange={() => setIsDepositChecked(!isDepositChecked)}/>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="block">Add Discount?</span>
                            <input type="checkbox" name="Discount" disabled={total <= 0 || isNaN(total)} checked={isDiscountChecked} onChange={() => setIsDiscountChecked(!isDiscountChecked)}/>
                        </div>
                    </div>
                    <div className="text-sm flex flex-col gap-4">
                        {
                            isDepositChecked &&
                            <div>
                                <span className="block">Deposit</span>
                                <input type="text" placeholder="Deposit Value" className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => setDeposit(Number(e.target.value))}/>
                            </div>
                        }
                        {
                            isDiscountChecked &&
                            <div>
                                <span className="block">Discount</span>
                                <input type="text" placeholder="Discount Value" className="w-full my-2 px-4 py-2 border-[1px] rounded-xl" onChange={(e) => setDiscount(Number(e.target.value))}/>
                            </div>
                        }
                    </div>
                    <div className="flex flex-col gap-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span>Price</span>
                            <span>{validateInputs() ? "N/A" : priceFormat}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Service Fee</span>
                            <span>{validateInputs() ? "N/A" : "EGP 10.00"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Total (per hr)</span>
                            <span>{validateInputs() ? "N/A" : `${totalFormat} ${(isDiscountChecked && total >= 0) ? `(-${(discount/total * 100).toFixed(2)}%)` : ""}`}</span>
                        </div>
                    </div>
                    {
                        isDepositChecked &&
                        <div className="flex items-center justify-between text-sm text-dark-gray">
                            <span>To Be Collected</span>
                            <span>{validateInputs() ? "N/A" : getCurrencyFormat((total - discount + 10) - deposit)}</span>
                        </div>
                    }
                    <Button variant={!validateInputs() ? "color" : "disabled"} className="my-4 py-[0.875rem]">Create Plan</Button>
                </form>
            </div>
        </>
    )
}