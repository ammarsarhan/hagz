import React, { createContext, useContext, useRef, useState } from 'react';

interface FormContextType<T> {
  error: string;
  setError: (error: string) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  data: T;
  setData: (data: T) => void;
}

export function createFormContext<T>() {
  return createContext<FormContextType<T> | undefined>(undefined);
}

interface FormContextProviderProps<T> {
  children: React.ReactNode;
  initial: T;
  context: React.Context<FormContextType<T> | undefined>;
}

export function FormContextProvider<T>({
  children,
  initial,
  context: Context,
}: FormContextProviderProps<T>) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setErrorWithTimeout = (error: string) => {
    setError(error);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setError(''), 3000);
  };

  const setErrorsWithTimeout = (errors: Record<string, string>) => {
    setErrors(errors);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setErrors({}), 3000);
  };

  return (
    <Context.Provider
      value={{
        data,
        setData,
        error,
        setError: setErrorWithTimeout,
        errors,
        setErrors: setErrorsWithTimeout,
      }}>
      {children}
    </Context.Provider>
  );
}

export function createFormContextHook<T>(context: React.Context<FormContextType<T> | undefined>) {
  return function useFormContext() {
    const ctx = useContext(context);
    if (!ctx) throw new Error('useFormContext must be used within a FormContextProvider');
    return ctx;
  };
}
