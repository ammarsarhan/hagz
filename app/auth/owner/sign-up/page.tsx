"use client"

import { FormEvent } from "react";
import { useFormContext } from "@/context/useFormContext";
import { User, Mail, CreditCard, Lock, MapPin, CheckSquare } from "lucide-react";

import NavLink from "@/components/ui/NavLink";
import Indicator from '@/components/auth/Indicator';
import FormWrapper from '@/components/auth/FormWrapper';
import Button from "@/components/ui/Button";
import UploadTrigger, { UploadModal } from "@/components/ui/Upload";
import CodeInput from '@/components/auth/CodeInput';

import Owner from "@/utils/types/owner";

// const Pitch = () => {
//     return (
//         <>
//             <LocationModal 
//                 active={false} 
//                 description="Add your pitch location manually or through Google Maps."
//                 closeModal={() => null}
//                 addHandler={() => null}
//             />
//             <div className="my-4 text-sm w-3/4">
//                 <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
//                     <div className="flex flex-col flex-1 gap-y-3 w-full">
//                         {/* <span className="text-red-700">{error}</span> */}
//                         <div className="flex flex-col gap-2 flex-1">
//                             <span className="text-dark-gray">Pitch Name</span>
//                             <input required type="text" placeholder="Name" className="py-2 px-3 border-[1px] rounded-lg"/>
//                         </div>
//                         <div className="flex flex-col gap-2 flex-1 my-2">
//                             <span className="text-dark-gray">Pitch Description</span>
//                             <input type="text" placeholder="Description (50 words max)" className="py-2 px-3 border-[1px] rounded-lg"/>
//                         </div>
//                         <div className="flex flex-col gap-2 flex-1">
//                             <div className="flex items-center justify-between my-2 gap-x-4">
//                                 <span className="text-dark-gray">Pitch Size</span>
//                                 <select required className="border-b-[1px] py-2 pr-5 outline-none">
//                                     <option value="5-A-Side">5-A-Side</option>
//                                     <option value="7-A-Side">7-A-Side</option>
//                                     <option value="11-A-Side">11-A-Side</option>
//                                 </select>
//                             </div>
//                             <div className="flex items-center justify-between my-2 gap-x-4">
//                                 <span className="text-dark-gray">Ground Type</span>
//                                 <select required className="border-b-[1px] py-2 pr-5 outline-none">
//                                     <option value="AG">Artifical Ground</option>
//                                     <option value="SG">Soft Ground</option>
//                                     <option value="FG">Firm Ground</option>
//                                     <option value="TF">Astro Turf</option>
//                                 </select>
//                             </div>
//                             <div className="flex items-center justify-between my-2 gap-x-4">
//                                 <div className="flex flex-col gap-1 text-dark-gray">
//                                     <span>Price Per Hour</span>
//                                     <span className="w-2/3">(Custom pricing options will be available once pitch is created)</span>
//                                 </div>
//                                 <input required type="number" min={100} max={9999} maxLength={4} placeholder="Price" className="border-b-[1px] p-2 !outline-0 w-24"/>
//                             </div>
//                         </div>
//                         <div className="flex items-center justify-between my-4 gap-x-4">
//                             <span>Pitch Location</span>
//                             <LocationTrigger onClick={() => null}/>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         </>
//     )
// }

// const Continued = () => {
//     return (
//         <>
//             <UploadModal 
//                 active={false} 
//                 closeModal={() => null}
//             />
//             <div className="flex flex-col gap-8 my-4 text-sm w-2/3">
//                 <div className="flex items-center justify-between gap-x-4">
//                     <span className="text-dark-gray">Pitch Images (0)</span>
//                     <UploadTrigger onClick={() => null}/>
//                 </div>
//                 <div>
//                     <span className="block mb-4 text-dark-gray">Pitch Amenities</span>
//                     <div className="flex flex-wrap gap-4 w-full rounded-md h-[30vh] border-[1px] px-3 py-4">
//                         <Button variant="primary" className="h-fit flex items-center gap-x-2 text-[0.8125rem]"><Plus className="w-4 h-4"/> Add Amenity</Button>
//                     </div>
//                 </div>
//             </div>
//         </>
//     )
// }
 

// let initialPitchData: Partial<Pitch> = {
//     id: "",
//     name: "",
//     description: "",
//     groundType: "SG",
//     pitchSize: "5-A-Side",
//     images: [],
//     location: {
//         longitude: 0,
//         latitude: 0,
//         street: "",
//         address: "",
//         city: "",
//         governorate: ""
//     },
//     rating: 0,
//     amenities: [],
//     activePricingPlan: {
//         price: 100,
//         deposit: null,
//         discount: null
//     },
//     pricingPlans: [],
//     reservations: [],
//     ownerId: ""
// } 

export default function SignUp () {
    const context = useFormContext();

    const indicators = [
        {title: "Basics", description: "Getting to know each other", image: <div className="p-2 rounded-md bg-white border-[1px]"><User className="w-4 h-4"/></div>},
        {title: "Advanced", description: "Help us tailor your experience", image: <div className="p-2 rounded-md bg-white border-[1px]"><MapPin className="w-4 h-4"/></div>},
        {title: "Security", description: "Secure your account", image: <div className="p-2 rounded-md bg-white border-[1px]"><Lock className="w-4 h-4"/></div>},
        {title: "Verify", description: "Enter your verification code", image: <div className="p-2 rounded-md bg-white border-[1px]"><Mail className="w-4 h-4"/></div>},
        {title: "Billing", description: "Set up methods for payment", image: <div className="p-2 rounded-md bg-white border-[1px]"><CreditCard className="w-4 h-4"/></div>},
        {title: "Finish", description: "Finalize your account creation", image: <div className="p-2 rounded-md bg-white border-[1px]"><CheckSquare className="w-4 h-4"/></div>}
    ];

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        context.actions.next();

        let account: Owner;

        if (context.properties.currentIndex === context.properties.steps.length - 2) {
            account = {
                id: "",
                profilePicture: "",
                pitches: [],
                paymentMethods: [context.data.activePaymentMethod],
                paymentHistory: [],
                ...context.data
            } as Owner;

            console.log(account);
        }
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
                                        <Indicator 
                                            active={index === context.properties.currentIndex} 
                                            title={el.title} description={el.description} 
                                            image={el.image} 
                                            key={index}
                                        />
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
                    <FormWrapper/>
                </form>
            </main>
        </div>
    )
}