"use client"

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { User, Mail, CreditCard, ChartLine, Lock, Upload, MapPin, Plus, Divide } from "lucide-react";
import useMultistepForm from "@/hooks/useMultistepForm";

import NavLink from "@/components/ui/NavLink";
import Button from "@/components/ui/Button";
import LocationTrigger, { LocationModal } from "@/components/ui/Location";
import Indicator from '@/components/auth/Indicator';
import Wrapper from '@/components/auth/Wrapper';
import OTP from '@/components/auth/OTP';

import Owner from "@/utils/types/owner";
import Pitch from "@/utils/types/pitch";
import AppLocation from "@/utils/types/location";
import { PaymentMethod, Card, Wallet, Cash, PricingPlan } from "@/utils/types/payment";

interface BasicsProps {
    firstName: string
    lastName: string
    company: string
    email: string
    phone: string,
    preferences: "Email" | "SMS" | "Phone",
    update: (fields: Partial<Owner>) => void
}

const Basics = ({firstName, lastName, company, email, phone, preferences, update} : BasicsProps) => {
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^0-9]/g, '');
        let formattedValue = "";
        
        if (input.length <= 4) {
            formattedValue = input;
        } else if (input.length <= 7) {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4)}`;
        } else {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4, 7)}-${input.slice(7, 11)}`;
        }

        update({phone: formattedValue});
    }

    return (
        <div className="my-4 text-sm w-3/4">
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-5 w-full">
                    <div className="flex flex-wrap gap-x-8 gap-y-5">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">First Name</span>
                            <input type="text" value={firstName} onChange={(e) => update({firstName: e.target.value})} required placeholder="First Name" className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Last Name</span>
                            <input type="text" value={lastName} onChange={(e) => update({lastName: e.target.value})} required placeholder="Last Name" className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Company Name</span>
                        <input type="text" value={company} onChange={(e) => update({company: e.target.value})} placeholder="Company (Optional)" className="py-2 px-3 border-[1px] rounded-lg"/>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Email Address</span>
                        <input type="email" value={email} required onChange={(e) => update({email: e.target.value})} placeholder="Email" className="py-2 px-3 border-[1px] rounded-lg"/>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Phone Number</span>
                        <input type="tel" pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}" value={phone} required onChange={(e) => handlePhoneChange(e)} placeholder="Phone" className="py-2 px-3 border-[1px] rounded-lg"/>
                    </div>
                    <div className="flex items-center justify-between my-2 gap-x-4">
                        <span>I consent to & prefer being contacted through:</span>
                        <select value={preferences} onChange={(e) => update({preferences: e.target.value as "Email" | "SMS" | "Phone"})} className="border-b-[1px] py-2 pr-10 outline-none">
                            <option value="Email">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="Phone">Phone</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface SecurityProps {
    password: string,
    phoneStatus: "Inactive" | "Verified" | "Suspended",
    update: (fields: Partial<Owner>) => void,
}

const Security = ({password, phoneStatus, update} : SecurityProps) => {
    const [timeLeft, setTimeLeft] = useState(30);
    const [sendLabel, setSendLabel] = useState("Send One-Time Code");
    const [displayCodeInput, setDisplayCodeInput] = useState(false);
    const [securityCode, setSecurityCode] = useState(9999);
    const [validated, setValidated] = useState(false);

    const handleReset = () => {
        setTimeLeft(30);
        setSendLabel("Resend Code");
        setDisplayCodeInput(false);
    }

    useEffect(() => {
        let timer: NodeJS.Timeout;

        if (displayCodeInput && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prevTime) => prevTime - 1);
            }, 1000);
        } else if (timeLeft == 0) {
            handleReset();
        }
        
        return () => clearInterval(timer);
    }, [timeLeft, displayCodeInput])

    const handleCodeClicked = () => {
        setDisplayCodeInput(true);
    }

    const handleCodeValidated = (validated: boolean) => {
        if (validated) {
            setValidated(true);
            setTimeLeft(0);
            update({phoneStatus: "Verified"});
        } else {
            handleReset();
        }
    }

    return (
        <div className="my-4 text-sm w-3/4">
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-5 w-full">
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Password (At least 8 characters & numbers)</span>
                            <input required pattern="(?=.*[a-zA-Z])(?=.*[0-9]).{8,}" value={password} type="password" placeholder="Password" onChange={(e) => update({password: e.target.value})} className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Re-enter Password</span>
                            <input required type="password" placeholder="Password" onChange={(e) => e.target.setCustomValidity((e.target.value == password) ? "" : "Passwords do not match")} className="py-2 px-3 border-[1px] rounded-lg"/>
                        </div>
                    </div> 
                    <div className="flex gap-3 flex-col">
                        <span className="text-dark-gray">2 Factor Authentication</span>
                        <div className="flex flex-col items-center justify-between gap-x-10 gap-y-4 lg:flex-row">
                            <p className={`text-dark-gray ${phoneStatus == "Verified" ? "w-full" : "w-full lg:w-1/2"}`}>{phoneStatus == "Verified" ? <>Your phone number has been verified successfully! Please press next to continue with the account creation process.</> : <>A one-time code will be sent to the phone number provided on the previous step. This code will be valid for <span className="text-black">{timeLeft}</span> {timeLeft != 1 ? "seconds" : "second"}. Make sure to enter it correctly within the specified time-frame.</>}</p>
                            {
                                displayCodeInput && timeLeft != 0 ?
                                <OTP code={securityCode} onSubmit={handleCodeValidated}/> :
                                phoneStatus != "Verified" && <Button variant="primary" className="w-full lg:w-1/2" onClick={handleCodeClicked} type="button">{sendLabel}</Button>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface VerifyProps {
    emailStatus: "Inactive" | "Verified" | "Suspended",
    update: (fields: Partial<Owner>) => void
}

const Verify = ({emailStatus, update} : VerifyProps) => {
    const [accountVerified, setAccountVerified] = useState(emailStatus == "Verified");

    useEffect(() => {
        if (accountVerified) {
            update({emailStatus: "Verified"});
        }
    }, [accountVerified])

    return (
        <div className="text-sm text-center my-4 w-2/3">
            <span className="text-dark-gray">Account Status: <span className={`${accountVerified ? "text-green-700" : "text-black"} ml-[0.125rem]`}>{accountVerified ? "Active" : "Not Verified"}</span></span>
        </div>
    )
}

interface BillingProps {
    type: "Cash" | "Card" | "Wallet",
    recieverName: string,
    details: Card | Wallet | Cash,
    updatePayment: (fields: Partial<PaymentMethod>) => void,
    updateCard: (fields: Partial<Card>) => void,
    updateWallet: (fields: Partial<Wallet>) => void
    updateCash: (fields: Partial<Cash>) => void
}

const Billing = ({
        type, 
        recieverName, 
        details,
        updatePayment, 
        updateCard, 
        updateWallet, 
        updateCash
    } : BillingProps) => 
{
    const [paymentType, setPaymentType] = useState(type);
    const handlePaymentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        switch (e.target.value) {
            case "Card":
                updatePayment({
                    type: "Card", 
                    details: {cardNumber: "", cvc: "", expiration: ""}
                });
                break;
            case "Wallet":
                updatePayment({
                    type: "Wallet", 
                    details: {phoneNumber: ""}
                });
                break;
            case "Cash":
                updatePayment({
                    type: "Cash", 
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
                });
                break;
        }

        setPaymentType(e.target.value as "Cash" | "Card" | "Wallet");
    }

    const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^0-9]/g, '');
        let formattedValue = "";

        if (input.length <= 4) {
            formattedValue = input;
        } else if (input.length <= 8) {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4)}`;
        } else if (input.length <= 12) {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4, 8)}-${input.slice(8)}`;
        } else {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4, 8)}-${input.slice(8, 12)}-${input.slice(12, 16)}`;
        }

        updateCard({cardNumber: formattedValue});
    }

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^0-9]/g, '');
        let formattedValue = "";
        
        if (input.length <= 4) {
            formattedValue = input;
        } else if (input.length <= 7) {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4)}`;
        } else {
            formattedValue = `${input.slice(0, 4)}-${input.slice(4, 7)}-${input.slice(7, 11)}`;
        }

        updateWallet({phoneNumber: formattedValue});
    }

    const handleExpirationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value.replace(/[^0-9]/g, '');
        let formattedValue = "";

        if (input.length <= 2) {
            formattedValue = input;
        } else if (input.length <= 4) {
            formattedValue = `${input.slice(0, 2)}/${input.slice(2)}`;
        }

        updateCard({expiration: formattedValue});
    }

    return (
        <div className="my-4 text-sm">
            <span className="block mb-4 text-dark-gray">Billing Information</span>
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-3 w-full">
                    <div className="flex items-center justify-between gap-x-2">
                        <span className="block">Billing Method</span>
                        <select className="border-b-[1px] py-2 pr-10 outline-none" value={type} onChange={(e) => handlePaymentTypeChange(e)}>
                            <option value="Card">Card</option>
                            <option value="Wallet">Mobile Wallet</option>
                            <option value="Cash">Cash</option>
                        </select>
                    </div>
                    {
                        paymentType == "Card" &&
                        <div className="flex flex-col gap-y-5 my-2">
                            <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Card Holder</span>
                                <input required value={recieverName} onChange={(e) => updatePayment({recieverName: e.target.value})} type="text" placeholder="Card Holder" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Credit/Debit Card Number</span>
                                <input required type="text" pattern="[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}" value={(details as Card).cardNumber} onChange={(e) => handleCardChange(e)} placeholder="Card Number" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-wrap gap-x-8 gap-y-5">
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">Expiration Month & Year</span>
                                    <input required type="text" maxLength={5} pattern="(0[1-9]|1[0-2])/[0-9]{2}" value={(details as Card).expiration} onChange={handleExpirationChange} placeholder="MM/YY" className="py-2 px-3 border-[1px] rounded-lg"/>
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <span className="text-dark-gray">CVC</span>
                                    <input required type="text" maxLength={3} pattern="[0-9\s]{3,4}" value={(details as Card).cvc} onChange={(e) => updateCard({cvc: e.target.value})} placeholder="Security Code" className="py-2 px-3 border-[1px] rounded-lg"/>
                                </div>
                            </div>
                        </div>
                    }
                    {
                        paymentType == "Wallet" &&
                        <div className="flex flex-col gap-y-5 my-2">
                            <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Recipient Name</span>
                                <input required value={recieverName} onChange={(e) => updatePayment({recieverName: e.target.value})} type="text" placeholder="Recipient" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <span className="text-dark-gray">Phone Number</span>
                                <input required type="tel" pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}" value={(details as Wallet).phoneNumber} onChange={(e) => handlePhoneChange(e)} placeholder="Phone" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                        </div>
                    }
                    {
                        paymentType == "Cash" &&
                        <div className="flex flex-col gap-y-5 mb-2">
                            <div className="flex flex-col gap-2 flex-1 my-2">
                                <span className="text-dark-gray">Recipient Name</span>
                                <input required value={recieverName} onChange={(e) => updatePayment({recieverName: e.target.value})} type="text" placeholder="Recipient" className="py-2 px-3 border-[1px] rounded-lg"/>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Set Cash Delivery Address</span>
                                <LocationTrigger/>
                            </div>
                        </div>
                    }
                    <p className="text-dark-gray mt-2">Note: You will not be able to recieve payments until your payment method has been verified. <Link href={"/faq"} className="text-blue-700 mt-1 hover:underline block w-fit">Learn more</Link></p>
                </div>
            </div>
        </div>
    )
}

interface PitchProps {
    name: string;
    description: string;
    groundType: "SG" | "AG" | "FG" | "TF";
    pitchSize: "5-A-Side" | "7-A-Side" | "11-A-Side";
    activePricingPlan: PricingPlan;
    update: (fields: Partial<Pitch>) => void;
    updatePlan: (fields: Partial<PricingPlan>) => void;
    updateLocation: (form: "pitch", fields: Partial<AppLocation>) => void;
}

const Pitch = ({
    name, 
    description, 
    groundType, 
    pitchSize, 
    activePricingPlan, 
    update, 
    updatePlan, 
    updateLocation
} : PitchProps) => {
    const [locationOpen, setLocationOpen] = useState(false);
    
    const handleAddLocationClicked = (fields: Partial<AppLocation>) => {
        updateLocation("pitch", {...fields});
        setLocationOpen(false);
    }

    return (
        <div className="my-4 text-sm w-3/4">
            <LocationModal 
                active={locationOpen} 
                description="Add your pitch location manually or through Google Maps." 
                closeModal={() => setLocationOpen(false)}
                addHandler={handleAddLocationClicked}
            />
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-3 w-full">
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Pitch Name</span>
                        <input required value={name} onChange={e => update({name: e.target.value})} type="text" placeholder="Name" className="py-2 px-3 border-[1px] rounded-lg"/>
                    </div>
                    <div className="flex flex-col gap-2 flex-1 my-2">
                        <span className="text-dark-gray">Pitch Description</span>
                        <input type="text" value={description} onChange={e => update({description: e.target.value})} placeholder="Description (50 words max)" className="py-2 px-3 border-[1px] rounded-lg"/>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between my-2 gap-x-4">
                            <span className="text-dark-gray">Pitch Size</span>
                            <select value={pitchSize} onChange={e => update({pitchSize: e.target.value as "5-A-Side" | "7-A-Side" | "11-A-Side"})} required className="border-b-[1px] py-2 pr-5 outline-none">
                                <option value="5-A-Side">5-A-Side</option>
                                <option value="7-A-Side">7-A-Side</option>
                                <option value="11-A-Side">11-A-Side</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between my-2 gap-x-4">
                            <span className="text-dark-gray">Ground Type</span>
                            <select value={groundType} onChange={e => update({groundType: e.target.value as "AG" | "SG" | "FG" | "TF"})} required className="border-b-[1px] py-2 pr-5 outline-none">
                                <option value="AG">Artifical Ground</option>
                                <option value="SG">Soft Ground</option>
                                <option value="FG">Firm Ground</option>
                                <option value="TF">Astro Turf</option>
                            </select>
                        </div>
                        <div className="flex items-center justify-between my-2 gap-x-4">
                            <div className="flex flex-col gap-1 text-dark-gray">
                                <span>Price Per Hour</span>
                                <span className="w-2/3">(Custom pricing options will be available once pitch is created)</span>
                            </div>
                            <input required value={activePricingPlan.price} onChange={e => updatePlan({price: parseInt(e.target.value)})} type="number" min={100} max={9999} maxLength={4} placeholder="Price" className="border-b-[1px] p-2 !outline-0 w-24"/>
                        </div>
                    </div>
                    <div className="flex items-center justify-between my-4 gap-x-4">
                        <span>Pitch Location</span>
                        <LocationTrigger onClick={() => setLocationOpen(true)}/>
                    </div>
                </div>
            </div>
        </div>
    )
}

const Continued = () => {
    return (
        <div className="flex flex-col gap-8 my-4 text-sm w-2/3">
            <div className="flex items-center justify-between gap-x-4">
                <span className="text-dark-gray">Pitch Images (0)</span>
                <Button variant="primary" className="flex items-center gap-x-3 text-[0.8125rem]"><Upload className="w-4 h-4"/> Add Images</Button>
            </div>
            <div>
                <span className="block mb-4 text-dark-gray">Pitch Amenities</span>
                <div className="flex flex-wrap gap-4 w-full rounded-md h-[30vh] border-[1px] px-3 py-4">
                    <Button variant="primary" className="h-fit flex items-center gap-x-2 text-[0.8125rem]"><Plus className="w-4 h-4"/> Add Amenity</Button>
                </div>
            </div>
        </div>
    )
}

let initialOwnerData: Partial<Owner> = {
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    password: "",
    pitches: [],
    activePaymentMethod: {
        type: "Card",
        recieverName: "",
        details: {
            cardNumber: "",
            cvc: "",
            expiration: "",
        }
    },
    location: {
        longitude: 0,
        latitude: 0,
        street: "",
        address: "",
        city: "",
        governorate: ""
    },
    preferences: "Email",
    phoneStatus: "Inactive",
    emailStatus: "Inactive",
}

let initialPitchData: Partial<Pitch> = {
    id: "",
    name: "",
    description: "",
    groundType: "SG",
    pitchSize: "5-A-Side",
    images: [],
    location: {
        longitude: 0,
        latitude: 0,
        street: "",
        address: "",
        city: "",
        governorate: ""
    },
    rating: 0,
    amenities: [],
    activePricingPlan: {
        price: 100,
        deposit: null,
        discount: null
    },
    pricingPlans: [],
    reservations: [],
    ownerId: ""
}

export default function SignUp () {
    const [ownerData, setOwnerData] = useState(initialOwnerData);
    const [pitchData, setPitchData] = useState(initialPitchData);

    const updatePaymentMethod = (fields: Partial<PaymentMethod>) => {
        setOwnerData((prevData) => {
            return {
                ...prevData, 
                activePaymentMethod: {
                    ...prevData.activePaymentMethod,
                    ...fields
                }
            } as Partial<Owner>;
        })
    }

    const updateLocation = (form: "owner" | "pitch", fields: Partial<AppLocation>) => {
        if (form === "owner") {
            setOwnerData((prevData) => {
                return {
                    ...prevData,
                    location: {
                        ...prevData,
                        ...fields
                    }
                } as Partial<Owner>
            })
        }
        if (form === "pitch") {
            setPitchData((prevData) => {
                return {
                    ...prevData,
                    location: {
                        ...prevData.location,
                        ...fields
                    }
                } as Partial<Pitch>
            })
        }
    }

    const updateOwner = (fields: Partial<Owner>) => {
        setOwnerData((prevData) => {
            return {...prevData, ...fields}
        })
    }

    const updateCard = (fields: Partial<Card>) => {
        setOwnerData((prevData) => {
            return {
                ...prevData,
                activePaymentMethod: {
                    ...prevData.activePaymentMethod,
                    details: {
                        ...prevData.activePaymentMethod!.details,
                        ...fields
                    }
                }
            } as Partial<Owner>
        })
    }
    
    const updateWallet = (fields: Partial<Wallet>) => {
        setOwnerData((prevData) => {
            return {
                ...prevData,
                activePaymentMethod: {
                    ...prevData.activePaymentMethod,
                    details: {
                        ...prevData.activePaymentMethod!.details,
                        ...fields
                    }
                }
            } as Partial<Owner>
        })
    }

    const updateCash = (fields: Partial<Cash>) => {
        setOwnerData((prevData) => {
            return {
                ...prevData,
                activePaymentMethod: {
                    ...prevData.activePaymentMethod,
                    details: {
                        ...prevData.activePaymentMethod!.details,
                        ...fields
                    }
                }
            } as Partial<Owner>
        })
    }

    const updatePitch = (fields: Partial<Pitch>) => {
        setPitchData((prevData) => {
            return {...prevData, ...fields}
        })
    }

    const updatePricingPlan = (fields: Partial<PricingPlan>) => {
        setPitchData((prevData) => {
            return {
                ...prevData,
                activePricingPlan: {
                    ...prevData.activePricingPlan,
                    ...fields
                }
            } as Partial<Pitch>
        })
    }

    const {currentStepIndex, step, steps, traverse, next, back} = useMultistepForm([
        <Basics {...ownerData} update={updateOwner}/>, 
        <Security {...ownerData} update={updateOwner}/>, 
        <Verify {...ownerData} update={updateOwner}/>, 
        <Billing {...ownerData.activePaymentMethod} 
            updatePayment={updatePaymentMethod} 
            updateCard={updateCard} 
            updateWallet={updateWallet} 
            updateCash={updateCash} />, 
        <Pitch {...pitchData} 
            update={updatePitch} 
            updatePlan={updatePricingPlan} 
            updateLocation={updateLocation}/>,
        <Continued/>
    ]);

    const indicators = [
        {title: "Basics", description: "Getting to know each other", image: <div className="p-2 rounded-md bg-white border-[1px]"><User className="w-4 h-4"/></div>},
        {title: "Security", description: "Secure your account", image: <div className="p-2 rounded-md bg-white border-[1px]"><Lock className="w-4 h-4"/></div>},
        {title: "Verify", description: "Enter your verification code", image: <div className="p-2 rounded-md bg-white border-[1px]"><Mail className="w-4 h-4"/></div>},
        {title: "Billing", description: "Set up methods for payment", image: <div className="p-2 rounded-md bg-white border-[1px]"><CreditCard className="w-4 h-4"/></div>},
        {title: "Pitch", description: "Create & link one or more pitches", image: <div className="p-2 rounded-md bg-white border-[1px]"><ChartLine className="w-4 h-4"/></div>} 
    ];

    const labels = [
        {title: "Create a free account", subtitle: "We'll need some information to get you up and running."},
        {title: "Set up security", subtitle: "Let's secure your account by providing a password and setting up 2-factor authentication."},
        {title: "Verify details", subtitle: "An email has been sent to the provided email address, follow steps to verify your account."},
        {title: "Payment & billing", subtitle: "Set up methods to handle payments and receive reservations."},
        {title: "Pitch details", subtitle: "We want some information to allow incoming users to view pitch details."},
        {title: "Pitch details (continued)", subtitle: "Just a few more details and you should be up and running!"},
    ]

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        next();
    }

    return ( 
        <div className="flex h-screen">
            <aside className="w-1/3 ml-4 my-4 p-6 rounded-md bg-gray-100 overflow-y-scroll">
                <div className="flex flex-col gap-y-8 w-full h-full">
                    <div className="mb-8">
                        Logo
                    </div>
                    <div className="flex flex-col flex-1 justify-between w-full h-full gap-y-20">
                        <div className="flex flex-col gap-y-8">
                            {
                                indicators.map((el, index) => {
                                    return (
                                        <Indicator active={currentStepIndex >= index} title={el.title} description={el.description} image={el.image} key={index}/>
                                    )
                                })
                            }
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <NavLink href="/" className="hover:text-blue-800 transition-none">Back to home</NavLink>
                            <NavLink href="/auth/owner/sign-in" className="hover:text-blue-800 transition-all">Sign In</NavLink>
                        </div>
                    </div>
                </div>
            </aside>
            <main className="w-2/3 p-5">
                <form className="h-full" onSubmit={onSubmit}>
                    <Wrapper 
                        next={next} 
                        back={back} 
                        index={currentStepIndex} 
                        lastIndex={steps.length - 1} 
                        title={labels[currentStepIndex].title} 
                        subtitle={labels[currentStepIndex].subtitle}
                    >
                        {step}
                    </Wrapper>
                </form>
            </main>
        </div>
    )
}