"use client";

import { ReactNode } from "react";
import { FormContextProvider } from "@/app/context/Form";

import Summary from "@/app/components/dashboard/pitch/create/steps/Summary";
import Details from "@/app/components/dashboard/pitch/create/steps/Details";
import Amenities from "@/app/components/dashboard/pitch/create/steps/Amenities";
import Grounds from "@/app/components/dashboard/pitch/create/steps/Grounds";
import Layout from "@/app/components/dashboard/pitch/create/steps/Layout";

import { pitch } from "@/app/utils/dashboard/config";
import { CreatePitchFormType } from "@/app/utils/types/dashboard";

export default function OnboardingProvider({ children } : { children: ReactNode }) {
    const steps = [
        {
            title: "Basic Information",
            description: "First of all, we need some information about your pitch.",
            label: "Details",
            component: <Details/>,
        },
        {
            title: "Pitch Amenities",
            description: "What amenities does your pitch provide? Having more amenities helps your pitch rank better in search results.",
            label: "Amenities",
            component: <Amenities/>,
        },
        {
            title: "Grounds",
            description: "Does your pitch have more than one ground? Each ground represents any bookable court within your sport complex.",
            label: "Grounds",
            component: <Grounds/>,
        },
        {
            title: "Layout",
            description: "How are your grounds organized? Can they be booked as combinations?",
            label: "Layout",
            component: <Layout/>,
        },
        {
            title: "Summary",
            description: "Just a quick check to make sure that everything will operate as you intend it to do.",
            label: "Summary",
            component: <Summary/>,
        }
    ]

    return (
        <FormContextProvider<CreatePitchFormType> initial={pitch} steps={steps}>
            {children}
        </FormContextProvider>
    )
}