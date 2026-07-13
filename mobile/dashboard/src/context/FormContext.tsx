import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';

type FormContextValue<Payload> = {
    state: Payload;
    setState: Dispatch<SetStateAction<Payload>>;
    setField: <K extends keyof Payload>(field: K, value: Payload[K]) => void;
};

export function createFormContext<Payload extends Record<string, any>>(initial: Payload) {
    const Context = createContext<FormContextValue<Payload> | null>(null);

    function Provider({ children }: { children: ReactNode }) {
        const [state, setState] = useState<Payload>(initial);

        const setField = <K extends keyof Payload>(field: K, value: Payload[K]) => setState((prev) => ({ ...prev, [field]: value }));

        return (
            <Context.Provider value={{ state, setState, setField }}>
                {children}
            </Context.Provider>
        );
    }

    function useFormContext() {
        const ctx = useContext(Context);
        if (!ctx) throw new Error('useFormContext must be used inside its Provider');
        return ctx;
    }

    return { Provider, useFormContext };
}
