import React, { createContext, useContext, useState } from 'react';
import { useForm } from '@tanstack/react-form';

export type FormContextStepType = React.ReactNode;

interface FormContextType {
    error: string;
    setError: (error: string) => void;
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
    initial: T;
    onSubmit?: (values: T) => Promise<void> | void;
}

export function FormContextProvider<T>({ children, initial, onSubmit }: FormContextProviderProps<T>) {
    const form = useForm({
        defaultValues: initial as any,
        onSubmit: async (values) => {
            if (onSubmit) {
                await onSubmit(values as T);
            }
        },
    });

    const [error, setError] = useState("");
    const isPending = form.state.isSubmitting || form.state.isValidating;

    const value = {
        error,
        setError,
        isPending,
        form,
    };

    return (
        <FormContext.Provider value={value}>
            {children}
        </FormContext.Provider>
    );
};