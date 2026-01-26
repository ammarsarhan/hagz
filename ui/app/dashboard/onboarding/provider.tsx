"use client";

import { ReactNode } from "react";

import useAuthContext from "@/app/context/Auth";
import { FormContextProvider } from "@/app/context/Form";

import Overview from "@/app/components/dashboard/pitch/create/steps/Overview";
import Details from "@/app/components/dashboard/pitch/create/steps/Details";
import Amenities from "@/app/components/dashboard/pitch/create/steps/Amenities";
import Grounds from "@/app/components/dashboard/pitch/create/steps/Grounds";
import Layout from "@/app/components/dashboard/pitch/create/steps/Layout";

import config from "@/app/utils/dashboard/config";
import Summary from "@/app/components/dashboard/pitch/create/steps/Summary";

export default function OnboardingProvider({ children } : { children: ReactNode }) {
    const { user } = useAuthContext();

    const steps = [
        {
            title: `Welcome, ${user?.firstName}!`,
            description: "Our pitch onboarding process should have you up and running in less than 10 minutes.",
            label: "Overview",
            component: <Overview/>,
        },
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
        <FormContextProvider initial={config.defaults.pitch} steps={steps}>
            {children}
        </FormContextProvider>
    )
}