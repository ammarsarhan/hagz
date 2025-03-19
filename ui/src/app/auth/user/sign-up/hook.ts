import { ReactNode, useState } from "react";

interface StepType {
    label: string,
    description: string,
    component: ReactNode
}

export default function useMultistepForm(steps: StepType[]) {
    const [index, setIndex] = useState(0);
    const step = steps[index];

    const next = () => {
        if (index < steps.length - 1) {
            setIndex(index + 1);
        }
    }

    const previous = () => {
        if (index <= steps.length - 1) {
            setIndex(index - 1);
        }
    }

    return { step, index, next, previous };
}