import { ReactNode, useState, useContext, createContext, SetStateAction, Dispatch } from "react";
import { ZodEffects, ZodObject } from "zod";

interface StepType {
    label: string,
    description: string,
    component: ReactNode,
    schema?: ZodObject<any> | ZodEffects<ZodObject<any>>
}

interface FormContextType<T> {
    step: StepType,
    index: number,
    loading: boolean,
    disabled: boolean,
    data: T,
    error: string | null,
    renderBack: () => boolean,
    renderNext: () => boolean,
    next: () => void,
    previous: () => void,
    setLoading: Dispatch<SetStateAction<boolean>>,
    setData: Dispatch<SetStateAction<T>>,
    setError: Dispatch<SetStateAction<string | null>>
}

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
    const [error, setError] = useState<string | null>(null);
    const [index, setIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    const step = steps[index];

    const next = () => {
        if (index < steps.length - 1) {
            setIndex((prev) => {
                // console.log not being reached here correctly
                console.log(prev, prev + 1);
                return prev + 1
            });
        }
    }

    const previous = () => {
        if (index > 0) {
            setIndex((prev) => prev - 1);
        }
    }

    const disabled = index == steps.length - 1;

    const renderBack = () => {
        let renderable = index != 0 ? true : false;

        if (loading) {
            renderable = false;
        }

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
            error,
            renderBack, 
            renderNext, 
            next, 
            previous, 
            setLoading, 
            setData,
            setError
        }}>
            {children}
        </FormContext.Provider>
    )
}
