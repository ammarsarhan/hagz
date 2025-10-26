import { FormEvent, useReducer, useState } from "react"

import { createBookingReducer } from "@/app/dashboard/pitch/[id]/(protected)/bookings/modals/create/reducer";
import Details from "@/app/dashboard/pitch/[id]/(protected)/bookings/modals/create/steps/Details";

import { BiPlus } from "react-icons/bi";
import { IoIosClose, IoMdArrowBack, IoMdArrowForward } from "react-icons/io";
import useBookingContext from "@/app/context/useBookingContext";

export default function CreateBookingModal({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { targets } = useBookingContext();

    const [state, dispatch] = useReducer(createBookingReducer, {
        source: "PLATFORM",
        target: targets[1]
    });

    if (!isOpen) return null;

    const steps = [
        {
            title: "Booking Details",
            component: <Details data={state} dispatch={dispatch}/>
        },
        {
            title: "Timeline & Pricing",
            component: <div>component</div>
        }
    ];

    const activeStep = steps[currentIndex];
    const isLast = currentIndex === steps.length - 1;

    const next = () => {
        if (!isLast) setCurrentIndex(prev => prev + 1);
        return;
    };

    const previous = () => {
        if (currentIndex != 0) setCurrentIndex(prev => prev - 1);
        return;
    };
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        next();
    };
    
    return (
        <div className="fixed top-0 left-0 flex items-center justify-end w-screen h-screen z-99 bg-black/50" onClick={onClose}>
            <form className="flex flex-col gap-y-4 gap-x-4 bg-gray-50 rounded-md p-6 m-4 h-[calc(100%-2rem)] w-lg" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-x-4 w-full border-b-[1px] border-gray-200 pb-4">
                    <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                        <h2 className="text-sm font-medium">Create Booking</h2>
                        <p className="text-[0.8125rem] text-gray-500 max-w-96">Add a new booking to your system for a user/guest.</p>
                    </div>
                    <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                        <IoIosClose className="size-6"/>
                    </button>
                </div>
                <div className="flex-1 my-1">
                    <div className="flex flex-col gap-y-0.5 mb-4">
                        <h2 className="text-sm font-medium">{activeStep.title}</h2>
                    </div>
                    {activeStep.component}
                </div>
                <div className="flex items-center justify-end gap-x-2 w-full border-t-[1px] border-gray-200 pt-4">
                    {
                        currentIndex != 0 &&
                        <button onClick={previous} className="flex items-center gap-x-1 border-[1px] border-gray-200 hover:bg-gray-100 rounded-md px-3.5 py-[0.55rem] cursor-pointer transition-colors">
                            <IoMdArrowBack className="size-3.5"/>
                            <span className="text-xs">Previous</span>
                        </button>
                    }
                    <button className="flex items-center gap-x-1 border-[1px] border-transparent bg-black hover:bg-black/80 text-white rounded-md px-3.5 py-[0.55rem] cursor-pointer transition-colors">
                        <span className="text-xs">{isLast ? "Create" : "Continue"}</span>
                        {isLast ? <BiPlus className="size-3.5"/> : <IoMdArrowForward className="size-3.5"/>}
                    </button>
                </div>
            </form>
        </div>
    )
}