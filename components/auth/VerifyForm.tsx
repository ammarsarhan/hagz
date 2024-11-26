import { useOwnerFormContext } from "@/context/useOwnerFormContext"
import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Loading from '@/components/ui/Loading';

import Cookies from "js-cookie";
import { CreationTokenType } from "@/utils/types/tokens";
import { decode } from 'jsonwebtoken';

export default function Verify () {
    const context = useOwnerFormContext();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let decoded: CreationTokenType | undefined = undefined;
        const creationCookie = Cookies.get("creationToken");
    
        if (creationCookie) {
            decoded = decode(creationCookie) as CreationTokenType;
        }
        
        const email = decoded?.email || context.data.email as string;

        context.actions.setRenderBack(false);
        context.actions.setRenderNext(false);

        const checkValidity = async () => {
            if (context.data.emailStatus == "Verified") {
                context.actions.setRenderNext(true);
            }

            if (context.data.emailStatus != "Verified") {
                setIsLoading(true);
                fetch('/api/auth/owner/verify', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: email
                    })
                })
                .then(res => {
                    try {
                        return res.json();
                    } catch (error) {
                        console.error("Could not convert response to JSON. Check internet connectivity then try again.")
                        return;
                    }
                })
                .then(data => {
                    if (data.message) {
                        context.updateData({
                            emailStatus: "Verified"
                        })
                    }
                })
                .then(() => {
                    setIsLoading(false);
                })
            }
        }

        checkValidity();
    }, [context])

    return (
        <div className="text-sm text-center mt-2 w-2/3">
            <div className="flex flex-col gap-y-8 items-center">
                {
                    isLoading ?
                    <Loading/> :
                    <>
                        <p className="text-dark-gray">
                            {
                                context.data.emailStatus === "Verified" ?
                                <span className="block mb-4">Click on next to create or link existing pitches and start managing reservations.</span> :
                                <>You will receive an email at: <span className="text-black">{context.data.email}</span> with a link to confirm your account creation. Follow the steps provided to verify your account.</> 
                            }
                        </p>
                        {
                            context.data.emailStatus === "Inactive" &&
                            <Button variant="primary" type="button" onClick={() => alert("Handle re-send verification email")}>Resend Verification Link</Button>
                        }
                    </>
                }
            </div>
        </div>
    )
}