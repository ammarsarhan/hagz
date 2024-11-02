import Button from "@/components/ui/Button";
import { useFormContext } from "@/context/useFormContext";
import { useState, ChangeEvent } from "react";

export default function Security () {
    const context = useFormContext();
    const [showPassword, setShowPassword] = useState(false);

    const handlePasswordChanged = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.value.length < 8) {
            e.target.setCustomValidity("Passowrd must be at least 8 characters long.")
        } else if (!/\d/.test(e.target.value)) {
            e.target.setCustomValidity("Password must contain at least 1 number.");
        } else if (!/[a-zA-Z]/.test(e.target.value)) {
            e.target.setCustomValidity("Password must contain at least 1 character.");
        } else {
            e.target.setCustomValidity("");
        }

        context.updateData({password: e.target.value});
    }

    const handleReChanged = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.value != context.data.password) {
            e.target.setCustomValidity("Both passwords must be the same.");
        } else {
            e.target.setCustomValidity("");
        }
    }

    return (
        <div className="my-4 text-sm w-3/4">
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-5 w-full">
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Password (At least 8 characters & numbers)</span>
                            <input 
                                value={context.data.password} 
                                onChange={e => handlePasswordChanged(e)} 
                                required 
                                pattern="(?=.*[a-zA-Z])(?=.*[0-9]).{8,}" 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Password" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Re-enter Password</span>
                            <input
                                onChange={e => handleReChanged(e)}
                                required 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Password" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                    </div> 
                    <div className="flex items-center gap-x-2">
                        <input 
                            type="checkbox" 
                            checked={showPassword} 
                            onChange={() => setShowPassword((prevValue) => prevValue ? false : true)}
                            />
                        <span>Show password</span>
                    </div>
                    <div className="flex gap-3 flex-col">
                        <span className="text-dark-gray">2 Factor Authentication</span>
                        <div className="flex flex-col items-center justify-between gap-x-10 gap-y-4 lg:flex-row">
                            <p className="text-dark-gray w-full lg:w-1/2">A one-time code will be sent to the phone number provided on the previous step. This code will be valid for 1 second. Make sure to enter it correctly within the specified time-frame.</p>
                            <Button variant="primary" className="w-full lg:w-1/2" type="button">Send Code</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}