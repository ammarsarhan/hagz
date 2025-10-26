import Button from "@/app/components/base/Button";

import { FcGoogle } from "react-icons/fc";
import { FaFacebookF } from "react-icons/fa6";

export function ProviderButton({ type, isAuth = false } : { type: "Facebook" | "Google", isAuth?: boolean }) {
    if (type === "Facebook") {
        return (
            <Button type="button">
                <FaFacebookF className="inline mr-2"/>
                <span>{isAuth ? "Sign In With Facebook" : "Sign Up With Facebook"}</span>
            </Button>
        );
    }
    
    if (type === "Google") {
        return (
            <Button type="button">
                <FcGoogle className="inline mr-2"/>
                <span>{isAuth ? "Sign In With Google" : "Sign Up With Google"}</span>
            </Button>
        )
    }
}