import { useOwnerFormContext } from "@/context/useOwnerFormContext";
import { useState, ChangeEvent } from "react";

export default function Security () {
    const context = useOwnerFormContext();
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
                        <span onClick={() => setShowPassword((prevValue) => prevValue ? false : true)}>Show password</span>
                    </div>
                    <span className="text-dark-gray">Note: Choose your password wisely, as it will be a direct access method to your reservation history and payment methods. Make sure to use an uncommon value with different letter, number, and special character combinations!</span>
                </div>
            </div>
        </div>
    )
}