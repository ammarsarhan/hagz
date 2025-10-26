/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useRef, useState } from 'react';
import z from 'zod';

export interface FormContextStepType {
    title: string, 
    description: string, 
    component: React.ReactNode
    schema: z.ZodObject | z.ZodArray,
    key: string
}

interface FormContextType {
    steps: FormContextStepType[];
    currentStep: FormContextStepType;
    currentIndex: number;
    setCurrentIndex: (index: number) => void;
    error: string;
    setError: (error: string) => void;
    errors: Record<string, string>;
    setErrors: (errors: Record<string, string>) => void;
    formData: any;
    setFormData: (data: any) => void;
    next: () => void;
    previous: () => void;
    isLast: boolean;
    isLoading: boolean;
    setIsLoading: (isLoading: boolean) => void;
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
    steps: Array<FormContextStepType>;
    initial: T,
    index?: number
}

export function FormContextProvider<T>({ children, steps, initial, index = 0 } : FormContextProviderProps<T>) {
    const [currentIndex, setCurrentIndex] = useState(index);
    const [formData, setFormData] = useState(initial);
    const [error, setError] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentStep = steps[currentIndex];
    const isLast = currentIndex === steps.length - 1;

    const next = () => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(currentIndex + 1);
        };
    };

    const previous = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const setErrorWithTimeout = (error: string) => {
        setError(error);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setError("");
        }, 3000);
    };

    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 3000);
    };

    const value = {
        steps,
        currentStep,
        currentIndex,
        setCurrentIndex,
        formData,
        setFormData,
        error,
        setError: setErrorWithTimeout,
        errors,
        setErrors: setErrorsWithTimeout,
        next,
        previous,
        isLast,
        isLoading,
        setIsLoading
    };

    return (
        <FormContext.Provider value={value}>
            {children}
        </FormContext.Provider>
    )
};