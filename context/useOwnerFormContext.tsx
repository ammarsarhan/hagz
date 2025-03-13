import Basics from "@/components/auth/BasicsForm";
import Advanced from "@/components/auth/AdvancedForm";
import Verify from "@/components/auth/VerifyForm";
import Security from "@/components/auth/SecurityForm";
import Finalize from "@/components/auth/FinalizeForm";
import Pitch from "@/components/auth/PitchForm";
import Continued from "@/components/auth/ContinuedForm";

import Cookies from "js-cookie";
import Owner from "@/utils/types/owner";
import Loading from "@/components/ui/Loading";
import usePrevious from "@/hooks/usePrevious";

import { decode } from "jsonwebtoken";
import { createContext, ReactNode, useContext, useState, useRef, useEffect } from "react";
import { CreationTokenType } from "@/utils/types/tokens";

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

export const OwnerFormContext = createContext<FormType | undefined>(undefined);

export function useOwnerFormContext() {
    const context = useContext(OwnerFormContext);

    if (context === undefined) {
        throw new Error("useOwnerFormContext must be initialized with an OwnerFormContext");
    }

    return context;
}

export const OwnerFormContextProvider = ({children} : {children: ReactNode}) => {
    let decoded: CreationTokenType | undefined = undefined;
    const creationCookie = Cookies.get("creationToken");

    if (creationCookie) {
        decoded = decode(creationCookie) as CreationTokenType;
    }

    let initalData: Partial<Owner> = {
        firstName: decoded?.name || "",
        lastName: "",
        company: "",
        email: decoded?.email || "",
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

    const [currentIndex, setCurrentIndex] = useState(0);
    const previousIndex = usePrevious(currentIndex);

    const [data, setData] = useState(initalData);
    const [overlay, setOverlay] = useState(true);
    const [pending, setPending] = useState(false);
    const [renderBack, setRenderBack] = useState(false);
    const [renderNext, setRenderNext] = useState(false);
    
    const [message, setMessage] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (decoded) {
            setCurrentIndex(3);
        } else {
            setCurrentIndex(0);
        }
        setOverlay(false);
    }, [])

    useEffect(() => {
        if (previousIndex < currentIndex) {
            setMessage("");
        }
    }, [currentIndex])

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
      <OwnerFormContext.Provider 
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
            {
                overlay ? <div className="fixed w-screen h-screen bg-white flex-center"><Loading/></div> : children
            }
      </OwnerFormContext.Provider>
    );
  };