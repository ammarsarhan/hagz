import { useState } from 'react';
import z from 'zod';

import Input from "@/app/components/auth/Input";
import Button from "@/app/components/base/Button";
import useFormContext from '@/app/context/useFormContext';
import { ProviderButton } from '@/app/components/auth/Button';
import Link from 'next/link';

// To create a new user, no extra steps exist currently.
// But to futureproof, we will use a useFormContext to allow for more steps to be added seamlessly.

// Schema with validation rules for firstName, lastName, email, phone, and password.
export const initialSchema = z.object({
    firstName: z
        .string({ error: "Please enter a valid first name." })
        .min(2, { error: "First name must be at least 2 characters." })
        .max(100, { error: "First name must be at most 100 characters." }),
    lastName: z
        .string({ error: "Please enter a valid last name." })
        .min(2, { error: "Last name must be at least 2 characters." })
        .max(100, { error: "Last name must be at most 100 characters." }),
    email: z
        .email({ error: "Please enter a valid email address." }),
    phone: z
        .string({ error: "Please enter a valid phone number." })
        .optional()
        .refine(val => !val || val.length === 0 || (val.length >= 10 && val.length <= 15), {
            error: "Phone number must be between 10 and 15 characters if provided."
        }),
    password: z
        .string({ error: "Please enter a valid password." })
        .min(8, { error: "Password must be at least 8 characters." })
        .max(100, { error: "Password must be at most 100 characters." })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/, { 
            error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
        })
});

// The currentStep component that will be shown to the user.
export default function Initial() {
    const [showPassword, setShowPassword] = useState(false);
    const { formData, setFormData, isLoading } = useFormContext();

    return (
        <div className="flex flex-col-reverse sm:flex-col">
            <div className="[@media(max-height:700px)]:hidden flex flex-col sm:flex-row items-center justify-center gap-x-4 gap-y-2 w-full my-6">
                <Link href="/auth/user/sign-up/google">
                    <ProviderButton type="Google"/>
                </Link>
                <Link href="/auth/user/sign-up/facebook">
                    <ProviderButton type="Facebook"/>
                </Link>
            </div>
            <div className="flex items-center gap-x-8 w-full [@media(max-height:700px)]:hidden">
                <div className="flex-1 bg-gray-200 h-[1px]"></div>
                <span>or</span>
                <div className="flex-1 bg-gray-200 h-[1px]"></div>
            </div>
            <div className="my-6 [@media(max-height:700px)]:mt-8">
                <div className="flex flex-col gap-y-4">
                    <div className="flex items-center gap-x-6 gap-y-4">
                        <Input label={"First Name"} placeholder="First Name" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})}/>
                        <Input label={"Last Name"} placeholder="Last Name" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})}/>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                        <Input label={"Email"} placeholder="Email Address" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}/>
                        <Input label={"Phone (Optional)"} placeholder="Phone Number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}/>
                    </div>
                    <div className="flex flex-col gap-y-4">
                        <Input label="Password" placeholder="Password" type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}/>
                        <div className="flex items-center gap-x-2">
                            <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)}/>
                            <span>Show password</span>
                        </div>
                    </div>
                    {
                        isLoading ?
                        <div className="w-40 flex items-center gap-x-1 rounded-full px-6 py-3 border-[1px] mx-auto text-white bg-gray-600! border-gray-600 [@media(max-height:700px)]:my-4">
                            <span className="block w-full text-center">Loading...</span>
                        </div> :
                        <Button type="submit" className="w-40 mx-auto text-white bg-black! hover:bg-gray-900! [@media(max-height:700px)]:my-4">
                            <span className="block w-full text-center">Next</span>
                        </Button>
                    }
                </div>
            </div>
        </div>
    )
}