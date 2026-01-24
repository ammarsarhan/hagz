"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useReducer, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import z from "zod";

import Button from "@/app/components/base/Button";
import Logo from "@/app/components/base/Logo";
import { InputGroup } from "@/app/components/base/Input";
import { signInSchema } from "@/app/schemas/user";
import { mutate } from "@/app/utils/api/base";
import parseErrors from "@/app/utils/schema";

import { FaArrowLeft } from "react-icons/fa6";
import keys from "@/app/utils/api/keys";
import { User } from "@/app/utils/types/user";

interface SignInPayload {
    phone: string;
    password: string;
}

interface SignInAction {
  field: keyof SignInPayload;
  value: string;
}

interface SignInResponse {
    user: User;
}

function signInReducer(state: SignInPayload, action: SignInAction) {
    return {
        ...state,
        [action.field]: action.value,
    };
};

export default function SignIn() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [errors, setErrors] = useState<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [state, dispatch] = useReducer(signInReducer, {
        phone: "",
        password: ""
    });

    const update = 
        (field: keyof SignInPayload) =>
        (e: React.ChangeEvent<HTMLInputElement>) =>
        dispatch({ field, value: e.target.value });

    const updatePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
        let digits = e.target.value.replace(/\D/g, "");

        if (digits.length > 11) digits = digits.slice(0, 11);

        let formatted = "";

        if (digits.length <= 4) {
            formatted = digits;
        } else if (digits.length <= 7) {
            formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
        } else {
            formatted = `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
        };

        dispatch({ field: "phone", value: formatted });
    };

    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 5000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = signInSchema.safeParse(state);

        if (!parsed.success) {
            const errors = parseErrors<z.infer<typeof signInSchema>>(parsed.error.issues);
            setErrorsWithTimeout(errors);
            return;
        };
        
        setErrors({});
        mutation.mutate();
    };

    const mutation = useMutation<SignInResponse, Error>({
        mutationFn: async () => await mutate("/auth/sign-in", state),
        onError: (error) => {
            setErrorsWithTimeout({ "general": error.message });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: keys.session });

            if (data.user.status == "UNVERIFIED") {
                router.push("/auth/verify");
                return;
            }

            switch (data.user.role) {
                case "USER":
                    router.push("/");
                    break;
                case "ADMIN":
                    router.push("/dashboard");
                    break;
            }
        }
    });

    return (
        <div className="h-full relative flex-center flex-col p-10">
            <div className="absolute top-4 left-4">
                <Link href="/" className="flex items-center gap-x-1.5 text-secondary hover:text-secondary/75 transition-all">
                    <FaArrowLeft className="size-3"/>
                    <span className="font-medium text-sm">Back to home</span>
                </Link>
            </div>
            <form className="w-full" onSubmit={handleSubmit}>
                <Logo/>
                <h1 className="font-semibold text-3xl w-full mt-4">Sign in back into Hagz</h1>
                <p className="text-gray-500 text-sm mt-2 mb-5">Book grounds for yourself and your friends, explore pitches, track your booking history, and make weekly recurring bookings.</p>
                <AnimatePresence>
                    {
                        errors["general"] &&
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-xxs text-red-600"
                        >
                            {errors["general"]}
                        </motion.p>
                    }
                </AnimatePresence>
                <div className="flex flex-col gap-y-4 mt-5 mb-10">
                    <InputGroup error={errors["phone"]} className="flex-1" label="Phone Number" type="text" placeholder="Phone" value={state.phone} onChange={updatePhone} />
                    <InputGroup error={errors["password"]} className="flex-1" label="Password" type="password" placeholder="Password" value={state.password} onChange={update("password")} />
                    <p className="text-xxs">Don&apos;t have an account? <Link href="/auth/sign-up" className="text-secondary hover:text-secondary/75 hover:underline">Sign up</Link></p>
                </div>
                <div className="w-full flex-center">
                    <Button variant="primary" type="submit" disabled={mutation.isPending}>
                        <span className="text-xxs font-medium">Sign In</span>
                    </Button>
                </div>
            </form>
            <span className="absolute bottom-6 right-6 text-gray-600 text-xs">© Hagz 2026</span>
        </div>
    )
}
