"use client"

import { FormEvent, useEffect } from "react";
import { useOwnerFormContext } from "@/context/useOwnerFormContext";
import { User, Mail, Lock, MapPin, CheckSquare, GalleryThumbnails, NotebookTabs } from "lucide-react";

import NavLink from "@/components/ui/NavLink";
import Indicator from '@/components/auth/Indicator';
import FormWrapper from '@/components/auth/FormWrapper';

import usePitchFormContext from "@/context/usePitchFormContext";
import useAuthContext from "@/context/useAuthContext";

import { decode } from "jsonwebtoken";
import { CreationTokenType } from "@/utils/types/tokens";
import Cookies from "js-cookie";

export default function SignUp () {
    const formContext = useOwnerFormContext();
    const pitchContext = usePitchFormContext();
    const authContext = useAuthContext();

    const indicators = [
        {title: "Basics", description: "Getting to know each other", image: <div className="p-2 rounded-md bg-white border-[1px]"><User className="w-4 h-4"/></div>},
        {title: "Advanced", description: "Help us tailor your experience", image: <div className="p-2 rounded-md bg-white border-[1px]"><MapPin className="w-4 h-4"/></div>},
        {title: "Security", description: "Secure your account", image: <div className="p-2 rounded-md bg-white border-[1px]"><Lock className="w-4 h-4"/></div>},
        {title: "Verify", description: "Enter your verification code", image: <div className="p-2 rounded-md bg-white border-[1px]"><Mail className="w-4 h-4"/></div>},
        {title: "Pitch", description: "Set up or link a pitch", image: <div className="p-2 rounded-md bg-white border-[1px]"><NotebookTabs className="w-4 h-4"/></div>},
        {title: "Pitch (Continued)", description: "Add more details to pitch", image: <div className="p-2 rounded-md bg-white border-[1px]"><GalleryThumbnails className="w-4 h-4"/></div>},
        {title: "Finish", description: "Finalize your account creation", image: <div className="p-2 rounded-md bg-white border-[1px]"><CheckSquare className="w-4 h-4"/></div>}
    ];

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (formContext.properties.currentIndex === 2) {
            formContext.actions.setLoading();
            formContext.actions.setRenderBack(false);

            fetch("/api/auth/owner/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formContext.data)
            })
            .then(response => {
                if (response.status === 500) {
                    formContext.actions.setError("Could not connect to server. Please check your connectivity.");
                    formContext.actions.setLoading();
                    formContext.actions.setRenderBack(true);
                    return;
                }
                return response.json()
            })
            .then(data => {
                if (!data) return;

                if (data.status === 403 || data.status === 400) {
                    formContext.actions.traverse(0);
                    formContext.actions.setError(data.message);
                    formContext.actions.setLoading();
                    return;
                }

                if (data.status != 200) {
                    formContext.actions.setError(data.message);
                    formContext.actions.setLoading();
                    formContext.actions.setRenderBack(true);
                    return;
                }

                formContext.actions.setLoading();
                formContext.actions.next();
            })
            .catch((error: Error) => {
                formContext.actions.setError(error.message);
                formContext.actions.setLoading();
            })
            return;
        }

        if (formContext.properties.currentIndex === 4 && pitchContext.mode === "Create") {
            const source = pitchContext.location;
            
            if (source.latitude && !source.longitude) {
                formContext.actions.setError("Location must contain either both or neither coordinates.");
                return;
            }
            
            if (source.longitude && !source.latitude) {
                formContext.actions.setError("Location must contain either both or neither coordinates.");
                return;
            }
            
            if (source.longitude && source.longitude < -180 || source.longitude && source.longitude > 180) {
                formContext.actions.setError("Location longitude must be between -180 and 180.")
                return;
            }
            
            if (source.latitude && source.latitude < -90 || source.latitude && source.latitude > 90) {
                formContext.actions.setError("Location latitude must be between -90 and 90.")
                return;
            }
    
            if ((source.street == "" || source.address == "" || source.governorate == "")) {
                formContext.actions.setError("You must set a valid pitch location.")
                return;
            }
            
            if (source.googleMapsLink) {
                const regex = /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.google\.com|goo\.gl)\/.+$/i;
                if (!regex.test(source.googleMapsLink)) {
                    formContext.actions.setError("Please enter a valid Google Maps link.")
                    return;
                }
            }
        }

        if (formContext.properties.currentIndex === 5) {
            formContext.actions.setLoading();
            formContext.actions.setRenderBack(false);

            let decoded: CreationTokenType | undefined = undefined;
            const creationCookie = Cookies.get("creationToken");

            if (creationCookie) {
                decoded = decode(creationCookie) as CreationTokenType;
            } else {
                formContext.actions.setError("Could not find creation token. Please try again.");
                formContext.actions.setLoading();
                formContext.actions.setRenderBack(true);
                return;
            }

            fetch("/api/pitch/create/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: decoded?.email,
                    pitch: pitchContext.data
                })
            })
            .then(response => {
                if (response.status === 500) {
                    formContext.actions.setError("Could not connect to server. Please check your connectivity.");
                    formContext.actions.setLoading();
                    formContext.actions.setRenderBack(true);
                    return;
                }
                return response.json()
            })
            .then(data => {
                if (!data) return;

                if (data.status === 403 || data.status === 400) {
                    formContext.actions.traverse(4);
                    formContext.actions.setError(data.message);
                    formContext.actions.setLoading();
                    return;
                }

                if (data.status != 200) {
                    formContext.actions.setError(data.message);
                    formContext.actions.setLoading();
                    formContext.actions.setRenderBack(true);
                    return;
                }

                formContext.actions.setLoading();
                formContext.actions.next();
            })
            .catch((error: Error) => {
                formContext.actions.setError(error.message);
                formContext.actions.setLoading();
            })
            return;
        }

        formContext.actions.next();
    }

    useEffect(() => {
        if (authContext.data.role == "Owner") {
            const invalidateRefreshToken = async () => {
                await fetch("/api/auth/owner/sign-out", {
                    method: 'POST',
                    credentials: 'include'
                });
                
                authContext.actions.setAccessToken(null);
                authContext.actions.setUser(null);
                authContext.actions.setRole(undefined);
            
                return;
            }
    
            invalidateRefreshToken();
        }
    }, [])    

    if (authContext.data.role != "Owner") {
        return (
            <div className="flex h-screen">
                <aside className="hidden lg:block w-1/3 m-4 p-6 rounded-md bg-gray-100 overflow-y-scroll">
                    <div className="flex flex-col gap-y-8 w-full h-full">
                        <div className="mb-8">
                            Logo
                        </div>
                        <div className="flex flex-col flex-1 justify-between w-full h-full gap-y-20">
                            <div className="flex flex-col gap-y-8">
                                {
                                    indicators.map((el, index) => {
                                        return (
                                            <Indicator 
                                                active={index === formContext.properties.currentIndex} 
                                                title={el.title} description={el.description} 
                                                image={el.image} 
                                                key={index}
                                            />
                                        )
                                    })
                                }
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <NavLink href="/" className="hover:text-blue-800 transition-none">Back to home</NavLink>
                                <NavLink href="/auth/owner/sign-in" className="hover:text-blue-800 transition-all">Sign In</NavLink>
                            </div>
                        </div>
                    </div>
                </aside>
                <main className="w-full lg:w-2/3 p-5">
                    <form className="h-full relative" onSubmit={onSubmit}>
                        <FormWrapper/>
                    </form>
                </main>
            </div>
        )
    }
}