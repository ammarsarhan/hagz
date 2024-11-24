import Basics from "@/components/auth/BasicsForm";
import Advanced from "@/components/auth/AdvancedForm";
import Verify from "@/components/auth/VerifyForm";
import Security from "@/components/auth/SecurityForm";
import Finalize from "@/components/auth/FinalizeForm";
import Pitch from "@/components/auth/PitchForm";
import Continued from "@/components/auth/ContinuedForm";

import Cookies from "js-cookie";
import Owner from "@/utils/types/owner";
import { createContext, ReactNode, useContext, useState, useRef, useEffect } from "react";

interface FormProperties {
    currentIndex: number,
    steps: ReactNode[],
    pending: boolean,
    error: string,
    renderBack: boolean,
    renderNext: boolean,
}

interface FormActions {
    next: () => void,
    back: () => void,
    traverse: (index: number) => void,
    setLoading: () => void,
    setError: (message: string) => void,
    setRenderBack: (value: boolean) => void,
    setRenderNext: (value: boolean) => void,
}

interface FormType {
    data: Partial<Owner>,
    properties: FormProperties,
    actions: FormActions,
    updateData: (fields: Partial<Owner>) => void
}

export const FormContext = createContext<FormType | undefined>(undefined);

export function useFormContext() {
    const context = useContext(FormContext);

    if (context === undefined) {
        throw new Error("useFormContext must be initialized with a FormContext");
    }

    return context;
}

export const OwnerFormProvider = ({children} : {children: ReactNode}) => {
    let initalData: Partial<Owner> = {
        firstName: localStorage.getItem("ownerFormName") || "",
        lastName: "",
        company: "",
        email: localStorage.getItem("ownerFormEmail") || "",
        phone: "",
        password: "",
        location: {
            building: "",
            street: "",
            address: "",
            city: "",
            governorate: "",
        },
        preferences: "Email",
        phoneStatus: "Inactive",
        emailStatus: "Inactive",
    }
    
    const localIndex = parseInt(localStorage.getItem("ownerFormIndex") || "0");
    const [currentIndex, setCurrentIndex] = useState(localIndex);
    const [data, setData] = useState(initalData);
    
    const [pending, setPending] = useState(false);
    const [renderBack, setRenderBack] = useState(false);
    const [renderNext, setRenderNext] = useState(false);
    
    const [message, setMessage] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (currentIndex === 3) {
            console.log("Token:", Cookies.get("ownerToken"));
            
            localStorage.setItem("ownerFormName", data.firstName as string);
            localStorage.setItem("ownerFormEmail", data.email as string);
            localStorage.setItem("ownerFormIndex", currentIndex.toString());
        }
    }, [currentIndex, data]);

    const steps = [
        <Basics key={0}/>,
        <Advanced key={1}/>,
        <Security key={2}/>,
        <Verify key={3}/>,
        <Pitch key={4}/>,
        <Continued key={5}/>,
        <Finalize key={6}/>
    ];

    const updateData = (fields: Partial<Owner>) => {
        setData((prevData) => {
            return {
                ...prevData,
                ...fields
            } as Partial<Owner>
        })
    };

    function next() {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }

    function back() {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }

    function traverse(index: number) {
        setCurrentIndex(index);
    }

    function setLoading() {
        setPending(prevData => {
            return !prevData;
        })
    }

    function setError(message: string) {
        setMessage(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            setError("");
            timeoutRef.current = null;
        }, 5000);
    }

    return (
      <FormContext.Provider 
        value={{
            data: data, 
            properties: {
                currentIndex: currentIndex,
                steps: steps,
                pending: pending,
                error: message,
                renderBack: renderBack,
                renderNext: renderNext,
            }, 
            actions: {
                next: next,
                back: back,
                traverse: traverse,
                setLoading: setLoading,
                setError: setError,
                setRenderBack: setRenderBack,
                setRenderNext: setRenderNext,
            },
            updateData: updateData
        }}>
        {children}
      </FormContext.Provider>
    );
  };