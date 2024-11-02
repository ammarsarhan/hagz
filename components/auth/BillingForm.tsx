import { ChangeEvent, useState } from "react";
import { useFormContext } from "@/context/useFormContext";
import { PaymentMethodType, Wallet, Card, Cash } from "@/utils/types/payment";

import LocationTrigger, { LocationModal } from "@/components/ui/Location";
import Link from "next/link";

export default function Billing () {
    const context = useFormContext();
    const card = context.data.activePaymentMethod?.details as Card;
    const wallet = context.data.activePaymentMethod?.details as Wallet;
    const cash = context.data.activePaymentMethod?.details as Cash;

    const [openLocation, setOpenLocation] = useState(false);

    const handleMethodChanged = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as PaymentMethodType;
        switch (value) {
            case "Card":
                context.updateBilling({
                    type: "Card",
                    recieverName: "",
                    details: {
                        cardNumber: "",
                        cvc: "",
                        expiration: ""
                    }
                })
                break;
            case "Wallet":
                context.updateBilling({
                    type: "Wallet",
                    recieverName: "",
                    details: {
                        phoneNumber: ""
                    }
                })
                break;
            case "Cash":
                context.updateBilling({
                    type: "Cash",
                    recieverName: "",
                    details: {
                        location: {
                            longitude: 0,
                            latitude: 0,
                            street: "",
                            address: "",
                            city: "",
                            governorate: ""
                        }
                    }
                })
                break;
        }
    }

    const handleCardChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }
        if (value.length > 9) {
            value = value.slice(0, 9) + '-' + value.slice(9);
        }
        if (value.length > 14) {
            value = value.slice(0, 14) + '-' + value.slice(14);
        }
        
        e.target.value = value;
        context.updateBilling({
            details: {
                cardNumber: e.target.value,
                cvc: card.cvc,
                expiration: card.expiration,
            }
        })
    }

    const handleExpirationChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');

        if (value.length >= 2) {
            const month = value.slice(0, 2);
            if (parseInt(month) > 12 || parseInt(month) < 1) {
                e.target.setCustomValidity("Please enter a valid month");
            } else {
                e.target.setCustomValidity("");
            }
        }

        if (value.length > 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        
        e.target.value = value;
        context.updateBilling({
            details: {
                cardNumber: card.cardNumber,
                cvc: card.cvc,
                expiration: e.target.value
            }
        })
    }

    const handlePhoneChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }
        if (value.length > 8) {
            value = value.slice(0, 8) + '-' + value.slice(8);
        }
        
        e.target.value = value;
        context.updateBilling({
            details: {
                phoneNumber: e.target.value
            }
        })
    }

    return (
        <>
            <LocationModal 
                active={openLocation} 
                source={cash.location}
                description="Add your billing address manually or through Google Maps."
                closeModal={() => setOpenLocation(false)}
            />
            <div className="my-4 text-sm">
                <span className="block mb-4 text-dark-gray">Billing Information</span>
                <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                    <div className="flex flex-col flex-1 gap-y-3 w-full">
                        <div className="flex items-center justify-between gap-x-2">
                            <span className="block">Billing Method</span>
                            <select 
                                value={context.data.activePaymentMethod?.type}
                                onChange={e => handleMethodChanged(e)}
                                className="border-b-[1px] py-2 pr-10 outline-none"
                            >
                                <option value="Card">Card</option>
                                <option value="Wallet">Mobile Wallet</option>
                                <option value="Cash">Cash</option>
                            </select>
                        </div>
                        {
                            context.data.activePaymentMethod?.type == "Card" &&
                            <div className="flex flex-col gap-y-5 my-2">
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Card Holder</span>
                                    <input 
                                        value={context.data.activePaymentMethod.recieverName}
                                        onChange={e => context.updateBilling({recieverName: e.target.value})}
                                        required 
                                        type="text" 
                                        placeholder="Card Holder" 
                                        className="py-2 px-3 border-[1px] rounded-lg"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Credit/Debit Card Number</span>
                                    <input 
                                        value={card.cardNumber}
                                        onChange={e => handleCardChanged(e)}
                                        maxLength={19}
                                        required 
                                        type="text" 
                                        pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}" 
                                        placeholder="Card Number" 
                                        className="py-2 px-3 border-[1px] rounded-lg"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-x-8 gap-y-5">
                                    <div className="flex flex-col gap-2 flex-1">
                                        <span className="text-dark-gray">Expiration Month & Year</span>
                                        <input 
                                            value={card.expiration}
                                            onChange={e => handleExpirationChanged(e)}
                                            required 
                                            type="text" 
                                            maxLength={5} 
                                            pattern="(0[1-9]|1[0-2])/[0-9]{2}" 
                                            placeholder="MM/YY" 
                                            className="py-2 px-3 border-[1px] rounded-lg"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 flex-1">
                                        <span className="text-dark-gray">CVC</span>
                                        <input 
                                            value={card.cvc}
                                            onChange={e => context.updateBilling({
                                                details: {
                                                    cardNumber: card.cardNumber,
                                                    cvc: e.target.value,
                                                    expiration: card.expiration
                                                }
                                            })}
                                            required 
                                            type="text" 
                                            maxLength={3} 
                                            pattern="[0-9\s]{3,4}" 
                                            placeholder="Security Code" 
                                            className="py-2 px-3 border-[1px] rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                        {
                            context.data.activePaymentMethod?.type == "Wallet" &&
                            <div className="flex flex-col gap-y-5 my-2">
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Recipient Name</span>
                                    <input 
                                        value={context.data.activePaymentMethod.recieverName}
                                        onChange={e => context.updateBilling({recieverName: e.target.value})}
                                        required 
                                        type="text" 
                                        placeholder="Recipient" 
                                        className="py-2 px-3 border-[1px] rounded-lg"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Phone Number</span>
                                    <input 
                                        value={wallet.phoneNumber}
                                        onChange={e => handlePhoneChanged(e)}
                                        required 
                                        maxLength={13}
                                        type="tel" 
                                        pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}" 
                                        placeholder="Phone" 
                                        className="py-2 px-3 border-[1px] rounded-lg"
                                    />
                                </div>
                            </div>
                        }
                        {
                            context.data.activePaymentMethod?.type == "Cash" &&
                            <div className="flex flex-col gap-y-5 mb-2">
                                <div className="flex flex-col gap-2 flex-1 my-2">
                                    <span className="text-dark-gray">Recipient Name</span>
                                    <input
                                        value={context.data.activePaymentMethod.recieverName}
                                        onChange={e => context.updateBilling({recieverName: e.target.value})}
                                        required 
                                        type="text" 
                                        placeholder="Recipient" 
                                        className="py-2 px-3 border-[1px] rounded-lg"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Set Cash Delivery Address</span>
                                    <LocationTrigger onClick={() => setOpenLocation(true)}/>
                                </div>
                            </div>
                        }
                        <p className="text-dark-gray mt-2">Note: You will not be able to recieve payments until your payment method has been verified. <Link href={"/faq"} className="text-blue-700 mt-1 hover:underline block w-fit">Learn more</Link></p>
                    </div>
                </div>
            </div>
        </>
    )
}