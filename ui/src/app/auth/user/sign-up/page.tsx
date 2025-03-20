"use client";

import { ChangeEvent, FormEvent, useCallback } from "react"
import { z } from "zod";
import { InputGroup, InputGroupContainer } from "@/components/input";
import Button from "@/components/button";
import FormContextProvider, { useFormContext } from "@/context/form";

interface FormDataType {
    firstName: string,
    lastName: string,
    email: string,
    phone: string,
    password: string,
    confirmPassword: string
}

const First = () => {
    const { data, setData } = useFormContext<FormDataType>();

    return (
        <>
            <InputGroupContainer>
                <InputGroup 
                    label="First Name" 
                    placeholder="First Name" 
                    value={data.firstName} 
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, firstName: e.target.value })}
                />
                <InputGroup 
                    label="Last Name" 
                    placeholder="Last Name" 
                    value={data.lastName} 
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, lastName: e.target.value })}
                />
            </InputGroupContainer>
            <InputGroup 
                label="Email" 
                placeholder="Email Address" 
                value={data.email} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, email: e.target.value })}
            />
            <InputGroup 
                label="Phone Number" 
                placeholder="Phone (xxxx-xxx-xxxx)" 
                value={data.phone} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, phone: e.target.value })}
            />
        </>
    )
};

const Second = () => {
    const { data, setData } = useFormContext<FormDataType>();

    return (
        <>
            <InputGroup 
                label="Password" 
                placeholder="Password"
                type="password"
                value={data.password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, password: e.target.value })}
            />
            <InputGroup 
                label="Confirm Password" 
                placeholder="Re-enter Password"
                value={data.confirmPassword}
                type="password"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, confirmPassword: e.target.value })}
            />  
        </>
    )
}

const Third = () => {
    const sendEmail = useCallback(async (email: string) => {
        const res = await fetch('http://127.0.0.1:3000/api/auth/user/verify/send', {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-type": "application/json"
            },
            body: JSON.stringify({ email: email })
        });

        const data = await res.json();
        return data;
    }, []);

    return <></>
}

const Form = () => {
    const { step, loading, disabled, data, error, renderBack, renderNext, next, previous, setError } = useFormContext<FormDataType>();

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        const schema = step.schema;

        if (schema) {
            const parsed = schema.safeParse(data);
            
            if (!parsed.success) {
                setError(parsed.error.errors[0].message);
                return;
            };
        }

        next();
    }

    return (
        <form className={`flex-center flex-col h-full border-r-[1px] px-8 ${disabled ? "gap-y-8" : "gap-y-12"}`} onSubmit={onSubmit}>
            <span className="text-sm text-red-500">{error}</span>
            <div className="flex-center flex-col text-center">
                <h1 className="text-2xl mb-2">{step.label}</h1>
                <p className="text-sm text-gray-500">{step.description}</p>
            </div>
            <div className="flex-center flex-col gap-y-5 w-full">
                {step.component}
            </div>
            {
                !disabled &&
                <div className="flex items-center justify-center gap-x-6 w-full">
                    {
                        renderBack() &&
                        <Button className="w-1/3 py-3 rounded-lg text-sm" variant="outline" onClick={previous}>
                            { !loading && "Previous" }
                        </Button>
                    }
                    {
                        renderNext() &&
                        <Button className="w-1/3 py-3 rounded-lg text-sm">
                            { !loading && "Next" }
                        </Button>
                    }
                </div>
            }
        </form>
    )
}

export default function Signup() {
    const initial: FormDataType = {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: ""
    };

    const steps = [
        {
            label: "Create A New Account",
            description: "Create a new account to start reserving with Hagz!",
            component: <First/>,
            schema: z.object({
                firstName: z.string().nonempty("First name is required.").min(2, "First name must be at least 2 characters.").max(50, "First name must be less than 50 characters."),
                lastName: z.string().nonempty("Last name is required.").min(2, "Last name must be at least 2 characters.").max(50, "Last name must be less than 50 characters."),
                email: z.string().email("Please use a valid email address."),
                phone: z.string().regex(/^[0-9]{4}-[0-9]{3}-[0-9]{4}$/, "Please match the specified phone number format."),
            })
        },
        {
            label: "Secure Your Account",
            description: "Choose a password to secure your account. Password must be at least 8 characters and contain a combination of characters and letters.",
            component: <Second/>,
            schema: z.object({
                password: z.string({ message: "Please enter valid text for the password." }).nonempty("Password is required.").min(8, "Password must be at least 8 characters.").max(255, "Password must be less than 255 characters."),
                confirmPassword: z.string({ message: "Please enter valid text for the confirm password." }).nonempty("Confirm password is required.").refine((data) => data === initial.password, { message: "Both passwords must match one another. Please try again." })
            })
        },
        {
            label: "Verify Your Account",
            description: "An email has been sent to the provided email address. Please follow the link sent to complete your sign up.",
            component: <Third/>
        },
    ];

    return (
        <div className="grid grid-cols-2 h-screen">
            <FormContextProvider steps={steps} initial={initial}>
                <Form/>
            </FormContextProvider>
            <div className="h-full"></div>
        </div>
    )
}