"use client"

import useMultistepForm from "@/hooks/useMultistepForm";
import { FormEvent, useState } from "react";
import { User, Mail, CreditCard, ChartLine, Lock } from "lucide-react";
import NavLink from "@/components/ui/NavLink";
import Indicator from '@/components/auth/Indicator';
import Wrapper from '@/components/auth/Wrapper';

// type Owner {
//     id: ID;
//     firstName: String;
//     lastName: String;
//     company: String | null;
//     email: String;
//     phone: String;
//     password: String;
//     profilePicture: String | null;
//     pitches: Pitch[];
//     activePaymentMethod: PaymentMethod;
//     paymentMethods: PaymentMethod[];
//     paymentHistory: Payment[];
//     location: Location;
//     preferences: PreferenceType;
//     status: StatusType;
// }

const Basics = () => {
    return (
        <>
            
        </>
    )
}

let ownerData = {
    id: "",
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    password: "",
    profilePicture: "",
    pitches: [],
    activePaymentMethod: null,
    paymentMethods: [],
    location: "",
    preferences: "",
    status: ""
}

export default function SignUp () {
    const [formData, setFormData] = useState(ownerData);
    const {currentStepIndex, step, steps, traverse, next, back} = useMultistepForm([1, 2, 3, 4, 5]);

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
        {title: "Payment & billing", subtitle: "Set up methods to handle payments."},
        {title: "Pitch details", subtitle: "Give us some details about the pitch."},
    ]

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        
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
                                        <Indicator active={currentStepIndex == index} title={el.title} description={el.description} image={el.image} key={index}/>
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