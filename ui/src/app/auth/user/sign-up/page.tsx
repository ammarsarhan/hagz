"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react"
import Link from "next/link";
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

    const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, "");

        if (value.length > 4) {
            value = value.slice(0, 4) + "-" + value.slice(4);
        }
        if (value.length > 8) {
            value = value.slice(0, 8) + "-" + value.slice(8);
        }

        setData({ ...data, phone: value });
    };

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
                onChange={handlePhoneChange}
            />
        </>
    )
};

const Second = () => {
    const { data, setData } = useFormContext<FormDataType>();
    const [reveal, setReveal] = useState(false);
    
    return (
        <>
            <InputGroup 
                label="Password" 
                placeholder="Password"
                type={reveal ? "text" : "password"}
                value={data.password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, password: e.target.value })}
            />
            <InputGroup 
                label="Confirm Password" 
                placeholder="Re-enter Password"
                value={data.confirmPassword}
                type={reveal ? "text" : "password"}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setData({ ...data, confirmPassword: e.target.value })}
            />
            <div className="flex items-center w-full">
                <input type="checkbox" className="mr-2" checked={reveal} onChange={() => setReveal(!reveal)}/>
                <span className="text-sm" onClick={() => setReveal(!reveal)}>Show Password</span>
            </div>
        </>
    )
}

const Third = () => {
    const { data } = useFormContext<FormDataType>();
    const timeout = 30;
    const masked = data.email.replace(/(?<=.{3}).(?=[^@]*?@)/g, "*");

    const [disabled, setDisabled] = useState(false);
    const [count, setCount] = useState(timeout);

    const formatCount = (time: number) => {
        return time < 10 ? `00:0${time}` : `00:${time}`;
    }

    const resendEmail = async () => {
        setDisabled(true);
        setCount(timeout);

        const interval = setInterval(() => {
            setCount(prev => prev - 1);
        }, 1000);

        setTimeout(() => {
            clearInterval(interval);
            setDisabled(false);
            setCount(timeout);
        }, timeout * 1000);
    }

    return (
        <>
            <div className="text-center">
                <p className="text-sm text-gray-500">We&apos;ve sent an email at the provided address:</p>
                <p>{masked}</p>
            </div>
            <div className="flex-center w-full mt-4">
                <Button 
                    className="w-full max-w-1/2 py-3 text-sm"   
                    disabled={disabled} 
                    onClick={resendEmail}
                >
                    {!disabled ? "Re-send email" : `${formatCount(count)}`}
                </Button>
            </div>
        </>
    )
}

const Form = () => {
    const { index, step, loading, disabled, data, error, renderBack, renderNext, next, previous, setError, setLoading } = useFormContext<FormDataType>();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const createUser = async () => {
        const body = {
            name: `${data.firstName} ${data.lastName}`,
            email: data.email,
            phone: data.phone,
            password: data.password
        }

        const res = await fetch("http://localhost:3000/api/auth/user/sign-up", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": ' application/json'
            },
            body: JSON.stringify(body)
        });

        const message = await res.json();
        return message;
    }

    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        };

        timeoutRef.current = setTimeout(() => {
            setError(null);
        }, 3000);
    }

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const schema = step.schema;

        if (schema) {
            const parsed = schema.safeParse(data);

            if (!parsed.success) {
                setErrorWithTimeout(parsed.error.errors[0].message);
                return;
            };
        };

        if (index == 1) {
            setLoading(true);
            const res = await createUser();

            if (res.success == false) {
                setErrorWithTimeout(res.message);
                setLoading(false);
                return;
            }
        };

        next();
    }

    return (
        <form className={`flex-center flex-col h-full border-r-[1px] px-8 ${disabled ? "gap-y-8" : "gap-y-12"}`} onSubmit={onSubmit}>
            <span className="text-sm text-center text-red-500">{error}</span>
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
                        <Button 
                            className="w-1/3 py-3 rounded-lg text-sm" 
                            variant="outline" 
                            onClick={previous}
                        >
                            Previous
                        </Button>
                    }
                    {
                        renderNext() &&
                        <Button 
                            className="w-1/3 py-3 rounded-lg text-sm" 
                            disabled={loading}
                        >
                            { !loading ? "Next" : "Loading..." }
                        </Button>
                    }
                </div>
            }
            {
                index == 0 &&
                <span className="text-sm text-gray-500">Already have an account? <Link href="/auth/user/log-in" className="text-blue-900">Log in.</Link></span>
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
                firstName: z.string().nonempty("Please use a valid first name.").min(2, "First name must be at least 2 characters.").max(50, "First name must be less than 50 characters."),
                lastName: z.string().nonempty("Please use a valid last name.").min(2, "Last name must be at least 2 characters.").max(50, "Last name must be less than 50 characters."),
                email: z.string().email("Please use a valid email address."),
                phone: z.string().regex(/^[0-9]{4}-[0-9]{3}-[0-9]{4}$/, "Please match the specified phone number format."),
            })
        },
        {
            label: "Secure Your Account",
            description: "Choose a password to secure your account. Password must be at least 8 characters and contain a combination of characters and letters.",
            component: <Second/>,
            schema: z.object({
                password: z.string().nonempty("Please enter a valid password.").min(8, "Password must be at least 8 characters.").max(255, "Password must be less than 255 characters.").regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/, { message: "Password must contain at least one uppercase letter, one number, and one special character." }),
                confirmPassword: z.string().nonempty("Confirm password is required.")
            }).refine(data => data.password === data.confirmPassword, { message: "Passwords do not match. Both passwords must match one another.", path: ["confirmPassword"] })
        },
        {
            label: "Verify Your Account",
            description: "Your account has been created successfully! Please verify your account to start reserving with Hagz.",
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