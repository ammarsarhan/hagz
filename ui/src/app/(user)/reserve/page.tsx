import { ReactNode } from "react";

interface ReserveStepType {
    title: string;
    component: ReactNode;
}

export function ReserveStep ({ step } : { step: ReserveStepType }) {
    return (
        <div className="h-full flex-center flex-col">
            {step.title}
            {step.component}
        </div>
    )
};

export default function Reserve() {
    const steps = [
        {
            title: "Pick a date",
            component: <div></div>
        }
    ]

    return (
        <div className="h-full">
            <ReserveStep step={steps[0]}/>
        </div>
    )
}