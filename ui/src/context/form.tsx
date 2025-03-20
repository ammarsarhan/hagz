import { ReactNode, useState, useContext, createContext, SetStateAction, Dispatch } from "react";

interface StepType {
    label: string,
    description: string,
    component: ReactNode
}

interface FormContextType<T> {
    step: StepType,
    index: number,
    loading: boolean,
    disabled: boolean,
    data: T,
    renderBack: () => boolean,
    renderNext: () => boolean,
    next: () => void,
    previous: () => void,
    setLoading: Dispatch<SetStateAction<boolean>>,
    setData: Dispatch<SetStateAction<T>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormContext = createContext<FormContextType<any> | undefined>(undefined);

export function useFormContext<T>() {
    const context = useContext(FormContext) as FormContextType<T>;

    if (!context) {
        throw new Error("useFormContext must be used within a FormContextProvider");
    }

    return context;
}

export default function FormContextProvider<T>({ children, steps, initial } : { children: ReactNode, steps: StepType[], initial: T }) {
    const [data, setData] = useState<T>(initial);
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
        <FormContext.Provider value={{ 
            step, 
            index, 
            loading, 
            disabled, 
            data, 
            renderBack, 
            renderNext, 
            next, 
            previous, 
            setLoading, 
            setData 
        }}>
            {children}
        </FormContext.Provider>
    )
}
