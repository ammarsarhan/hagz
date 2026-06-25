import React, { createContext, useContext, useState } from 'react';
import { useForm } from '@tanstack/react-form';

export type FormContextStepType = React.ReactNode;

interface FormContextType {
    steps: FormContextStepType[];
    currentStep: FormContextStepType;
    index: number;
    setIndex: (index: number) => void;
    error: string;
    setError: (error: string) => void;
    next: () => void;
    previous: () => void;
    isLast: boolean;
    isPending: boolean;
    form: any;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export default function useFormContext() {
    const context = useContext(FormContext);

    if (!context) {
        throw new Error("useFormContext must be used within a FormProvider");
    }

    return context;
}

interface FormContextProviderProps<T> { 
    children: React.ReactNode,
    steps: FormContextStepType[];
    initial: T;
    onSubmit?: (values: T) => Promise<void> | void;
}

export function FormContextProvider<T>({ children, steps, initial, onSubmit }: FormContextProviderProps<T>) {
    const form = useForm({
        defaultValues: initial as any,
        onSubmit: async (values) => {
            if (onSubmit) {
                await onSubmit(values as T);
            }
        },
    });

    const [index, setIndex] = useState(0);
    const [error, setError] = useState("");
    const isPending = form.state.isSubmitting || form.state.isValidating;

    const currentStep = steps[index];
    const isLast = index === steps.length - 1;

    const next = () => {
        if (index < steps.length - 1) {
            setIndex(index + 1);
        };
    };

    const previous = () => {
        if (index > 0) {
            setIndex(index - 1);
        }
    };

    const value = {
        steps,
        currentStep,
        index,
        setIndex,
        error,
        setError,
        next,
        previous,
        isLast,
        isPending,
        form,
    };

    return (
        <FormContext.Provider value={value}>
            {children}
        </FormContext.Provider>
    );
};