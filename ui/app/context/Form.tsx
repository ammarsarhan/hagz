import { useContext, createContext, useState, SetStateAction, Dispatch, useRef } from "react";

interface FormContextType<T> {
    data: T;
    setData: Dispatch<SetStateAction<T>>;
    index: number;
    steps: Array<React.ReactNode>;
    next: () => void;
    previous: () => void;
    errors: Record<string, string>;
    setErrors: (error: Record<string, string>) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FormContext = createContext<FormContextType<any> | undefined>(undefined);

export default function useFormContext() {
    const context = useContext(FormContext);
    if (context === undefined) throw new Error("useFormContext must be used within a FormContextProvider.");
    return context;
};

export function FormContextProvider<T>({ initial, steps, children } : { initial: T, steps: React.ReactNode[], children: React.ReactNode }) {
    const [data, setData] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [index, setIndex] = useState(0);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const next = () => {
        if (index >= steps.length - 1) return;
        setIndex(prev => prev + 1);
    };

    const previous = () => {
        if (index <= 0) return;
        setIndex(prev => prev - 1);
    };

    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 5000);
    };

    return (
        <FormContext.Provider value={{ data, setData, index, steps, next, previous, errors, setErrors: setErrorsWithTimeout }}>
            { children }
        </FormContext.Provider>
    )
};
