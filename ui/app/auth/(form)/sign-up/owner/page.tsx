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
import { Modal } from "@/app/components/base/Modal";
import { userDetailsSchema } from "@/app/schemas/user";
import { mutate } from "@/app/utils/api/base";
import keys from "@/app/utils/api/keys";
import parseErrors from "@/app/utils/schema";

import { FaArrowLeft, FaFileContract } from "react-icons/fa6";
import { IoIosClose } from "react-icons/io";

interface CreateUserPayload {
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
}

interface CreateUserAction {
  field: keyof CreateUserPayload
  value: string
}

function createUserReducer(state: CreateUserPayload, action: CreateUserAction) {
    return {
        ...state,
        [action.field]: action.value,
    };
};

export default function SignUp() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [state, dispatch] = useReducer(createUserReducer, {
        firstName: "",
        lastName: "",
        phone: "",
        password: ""
    });

    const update = 
        (field: keyof CreateUserPayload) =>
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

    const handleCloseModal = () => {
        if (mutation.isPending) return;
        setIsModalOpen(false); 
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const parsed = userDetailsSchema.safeParse(state);

        if (!parsed.success) {
            const errors = parseErrors<z.infer<typeof userDetailsSchema>>(parsed.error.issues);
            setErrorsWithTimeout(errors);
            return;
        };
        
        setErrors({});
        setIsModalOpen(true);
    };

    const mutation = useMutation({
        mutationFn: async () => await mutate("/auth/sign-up/owner", state),
        onError: (error) => {
            setErrorsWithTimeout({ "general": error.message });
            setIsModalOpen(false);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: keys.session })
            router.push("/dashboard");
        }
    });

    return (
        <>
            <Modal isOpen={isModalOpen} className="w-full md:w-xl bg-white rounded-md p-6 m-4" onClose={handleCloseModal}>
                <div className="w-full flex items-center justify-end">
                    <button type="button" className="text-gray-700 hover:text-gray-500 transition-colors" onClick={() => setIsModalOpen(false)}>
                        <IoIosClose className="size-6"/>
                    </button>
                </div>
                <div className="flex-center flex-col gap-y-4 my-4 px-3">
                    <FaFileContract className="size-10"/>
                    <h1 className="font-semibold text-center text-xl">We uphold punctuality standards to keep our community safe.</h1>
                    <p className="text-gray-700 text-xxs">By using Hagz, you agree to our Terms of Service and Privacy Policy. Great experiences start with mutual respect; staying punctual and keeping up with payments helps us protect the rights of both owners and users. Your commitment to showing up on time is what makes our community great and keeps Hagz reliable for everyone.</p>
                    <Button className="mt-2" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                        <span className="font-medium">I Understand, Create My Account</span>
                    </Button>
                </div>
            </Modal>
            <div className="h-full relative flex-center flex-col p-10">
                <div className="absolute top-4 left-4">
                    <Link href="/" className="flex items-center gap-x-1.5 text-secondary hover:text-secondary/75 transition-all">
                        <FaArrowLeft className="size-3"/>
                        <span className="font-medium text-sm">Back to home</span>
                    </Link>
                </div>
                <form className="w-full" onSubmit={handleSubmit}>
                    <Logo/>
                    <h1 className="font-semibold text-3xl w-full mt-4">Create an owner account <br/> with Hagz</h1>
                    <p className="text-gray-500 text-sm mt-2 mb-5">Create pitches and grounds, add manual bookings and payment methods, track your earnings, and invite team members to help manage your pitch.</p>
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
                        <div className="flex items-center gap-x-4">
                            <InputGroup error={errors["firstName"]} className="flex-1" label="First Name" type="text" placeholder="First Name" value={state.firstName} onChange={update("firstName")} />
                            <InputGroup error={errors["lastName"]} className="flex-1" label="Last Name" type="text" placeholder="Last Name" value={state.lastName} onChange={update("lastName")} />
                        </div>
                        <InputGroup error={errors["phone"]} className="flex-1" label="Phone Number" type="text" placeholder="Phone" value={state.phone} onChange={updatePhone} />
                        <InputGroup error={errors["password"]} className="flex-1" label="Password" type="password" placeholder="Password" value={state.password} onChange={update("password")} />
                        <p className="text-xxs">Already have an account? <Link href="/auth/sign-in" className="text-secondary hover:text-secondary/75 hover:underline">Sign in</Link></p>
                    </div>
                    <div className="w-full flex-center">
                        <Button variant="primary" type="submit" disabled={mutation.isPending}>
                            <span className="text-xxs font-medium">Sign Up</span>
                        </Button>
                    </div>
                </form>
                <span className="absolute bottom-6 right-6 text-gray-600 text-xs">© Hagz 2026</span>
            </div>
        </>
    )
}
