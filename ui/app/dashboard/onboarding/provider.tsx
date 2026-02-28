"use client";

import { ReactNode } from "react";
import { FormContextProvider } from "@/app/context/Form";

import Details from "@/app/components/dashboard/pitch/create/steps/Details";
import Location from "@/app/components/dashboard/pitch/create/steps/Location";
import Amenities from "@/app/components/dashboard/pitch/create/steps/Amenities";
import Grounds from "@/app/components/dashboard/pitch/create/steps/Grounds";
import Summary from "@/app/components/dashboard/pitch/create/steps/Summary";

import { pitch } from "@/app/utils/dashboard/config";
import { Pitch } from "@/app/utils/types/dashboard";

export default function OnboardingProvider({ children } : { children: ReactNode }) {
    const initial = pitch();

    const steps = [
        {
            title: "Basic Information",
            description: "First of all, we need some information about your pitch.",
            label: "Details",
            component: <Details/>,
        },
        {
            title: "Location",
            description: "Describe your pitch's location in more detail. This will help users find your pitch and help us set up language & currency for you.",
            label: "Location",
            component: <Location/>,
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
            title: "Summary",
            description: "Just a quick check to make sure that everything will operate as you intend it to do.",
            label: "Summary",
            component: <Summary/>,
        }
    ]

    return (
        <FormContextProvider<Pitch> initial={initial} steps={steps}>
            {children}
        </FormContextProvider>
    )
}