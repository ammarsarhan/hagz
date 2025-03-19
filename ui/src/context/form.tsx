import { ReactNode, useState, useContext, createContext } from "react";

interface StepType {
    label: string,
    description: string,
    component: ReactNode
}

interface FormContextType {
    step: StepType,
    index: number,
    loading: boolean,
    disabled: boolean,
    renderBack: () => boolean,
    renderNext: () => boolean,
    next: () => void,
    previous: () => void,
    setLoading: (loading: boolean) => void
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export function useFormContext() {
    const context = useContext(FormContext);

    if (!context) {
        throw new Error("useFormContext must be used within a FormContextProvider");
    }

    return context;
}

export default function FormContextProvider({ children, steps } : { children: ReactNode, steps: StepType[] }) {
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(false);
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

    const disabled = index == steps.length - 1;

    const renderBack = () => {
        const renderable = index != 0 ? true : false;
        return renderable;
    }

    const renderNext = () => {
        const renderable = index < steps.length - 1 ? true : false;
        return renderable;
    }

    return (
        <FormContext.Provider value={{ step, index, loading, disabled, renderBack, renderNext, next, previous, setLoading }}>
            {children}
        </FormContext.Provider>
    )
}
