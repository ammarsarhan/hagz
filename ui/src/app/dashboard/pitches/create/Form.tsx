"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { updatePitchDraft } from "@/app/utils/api/client";
import useFormContext from "@/app/context/useFormContext";

export interface MutationProps {
    key: string;
    payload: object | Array<object>;
};

export default function Form() {
    const { steps, setErrors, formData, currentStep, currentIndex, previous, next } = useFormContext();
    const router = useRouter();

    const isLayoutBuilder = currentIndex === 2;
    const isLast = currentIndex === steps.length - 1;

    const mutation = useMutation({
        mutationFn: updatePitchDraft,
        onSuccess: () => {
            if (isLast) {
                router.push("/dashboard");
                return;
            };
            
            next();
            window.scrollTo(0, 0);
        },
        onError: (error) => {
            console.log(error.message);
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate current step
        const schema = currentStep.schema;
        let key = currentStep.key;
        const payload = formData[key];

        if (schema) {
            const parsed = schema.safeParse(payload);
    
            if (!parsed.success) {
                window.scrollTo(0, 0);
    
                const errors: Record<string, string> = {};
                parsed.error.issues.forEach((issue) => {
                    const path = issue.path.join(".");
                    errors[`${key}.${path}`] = issue.message;
                });
    
                setErrors(errors);
                return;
            }
        };

        key = key.toUpperCase();
        mutation.mutate({ key, payload });
    };

    const handlePrevious = () => {
        previous();
        window.scrollTo(0, 0);
    };

    return (
        <form className="relative flex gap-x-4 w-full h-full" onSubmit={handleSubmit}>
            <div className="pt-7 px-6 pb-6" style={!isLayoutBuilder ? { width: "100%", position: "absolute" } : { position: "relative", width: "calc(100% - 20rem)" }}>
                <div className="flex flex-col gap-y-0.5 border-b-[1px] pb-4 border-gray-200 w-full">
                    <span className="text-[0.8125rem] text-gray-600">Step {currentIndex + 1}/{steps.length}</span>
                    <h2 className="text-lg font-semibold">{currentStep.title}</h2>
                    <span className="text-[0.8125rem] text-gray-600 max-w-1/2">{currentStep.description}</span>
                </div>
                <div className="my-5 text-[0.8125rem]">
                    {currentStep.component}
                </div>
                {!isLayoutBuilder && (
                    <div className="flex items-center gap-x-2 justify-end">
                        {
                            currentIndex !== 0 && (
                                <button onClick={handlePrevious} type="button" className="mt-2 flex items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2.5 border-gray-300 hover:bg-gray-100 transition-colors w-32 cursor-pointer">
                                    <span className="text-[0.8125rem]">Previous</span>
                                </button>
                            )
                        }
                        <button type="submit" className="mt-2 flex items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2.5 text-white bg-black hover:bg-gray-800 transition-colors w-32 cursor-pointer">
                            <span className="text-[0.8125rem]">{isLast ? "Finish" : "Next"}</span>
                        </button>
                    </div>
                )}
            </div>
        </form>
    );
}
