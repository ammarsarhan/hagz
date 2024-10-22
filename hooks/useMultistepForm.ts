import { ReactNode, useState } from "react";

export default function useMultistepForm (steps: ReactNode[]) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    function traverse(stepIndex: number) {
        setCurrentStepIndex(stepIndex);
    }

    function next() {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        }
    }

    function back() {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(currentStepIndex - 1);
        }
    }

    return {
        currentStepIndex,
        step: steps[currentStepIndex],
        steps,
        traverse,
        next,
        back,
    }
}