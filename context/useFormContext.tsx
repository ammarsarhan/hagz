import Basics from "@/components/auth/BasicsForm";
import Advanced from "@/components/auth/AdvancedForm";
import Verify from "@/components/auth/VerifyForm";
import Security from "@/components/auth/SecurityForm";
import Billing from "@/components/auth/BillingForm";
import Finalize from "@/components/auth/FinalizeForm";

import Owner from "@/utils/types/owner";
import { createContext, ReactNode, useContext, useState } from "react";
import { PaymentMethod } from "@/utils/types/payment";

interface FormProperties {
    currentIndex: number,
    steps: ReactNode[],
}

interface FormActions {
    next: () => void,
    back: () => void,
}

interface FormType {
    data: Partial<Owner>,
    properties: FormProperties,
    actions: FormActions,
    updateData: (fields: Partial<Owner>) => void,
    updateBilling: (fields: Partial<PaymentMethod>) => void,
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
        firstName: "Ammar",
        lastName: "Sarhan",
        company: "",
        email: "ammar@gmail.com",
        phone: "0106-151-3190",
        password: "2911980aaa",
        pitches: [],
        activePaymentMethod: {
            type: "Card",
            recieverName: "Ammar Sarhan",
            details: {
                cardNumber: "0000-0000-0000-0000",
                cvc: "333",
                expiration: "10/25",
            }
        },
        location: {
            building: "",
            street: "",
            address: "",
            city: "",
            governorate: "Alexandria",
        },
        preferences: "Email",
        phoneStatus: "Inactive",
        emailStatus: "Inactive",
    }

    const [data, setData] = useState(initalData);
    const [currentIndex, setCurrentIndex] = useState(0);

    const steps = [
        <Basics key={0}/>,
        <Advanced key={1}/>,
        <Security key={2}/>,
        <Verify key={3}/>,
        <Billing key={4}/>,
        <Finalize key={5}/>
    ];

    const updateData = (fields: Partial<Owner>) => {
        setData((prevData) => {
            return {
                ...prevData,
                ...fields
            } as Partial<Owner>
        })
    };

    const updateBilling = (fields: Partial<PaymentMethod>) => {
        setData((prevData) => {
            return {
                ...prevData,
                activePaymentMethod: {
                    ...prevData.activePaymentMethod,
                    ...fields
                }
            } as Partial<Owner>
        })
    }

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

    return (
      <FormContext.Provider 
        value={{
            data: data, 
            properties: {
                currentIndex: currentIndex,
                steps: steps,
            }, 
            actions: {
                next: next,
                back: back,
            },
            updateData: updateData,
            updateBilling: updateBilling,
        }}>
        {children}
      </FormContext.Provider>
    );
  };