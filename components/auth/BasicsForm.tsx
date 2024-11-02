import { useFormContext } from "@/context/useFormContext"
import { PreferencesType } from "@/utils/types/owner";

export default function Basics () {
    const context = useFormContext();

    const handlePhoneChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }
        if (value.length > 8) {
            value = value.slice(0, 8) + '-' + value.slice(8);
        }
        
        e.target.value = value;
        context.updateData({phone: e.target.value});
    }

    return (
        <div className="my-4 text-sm w-3/4">
            <div className="flex flex-col items-start flex-wrap md:flex-row gap-x-10 gap-y-6">
                <div className="flex flex-col flex-1 gap-y-5 w-full">
                    <div className="flex flex-wrap gap-x-8 gap-y-5">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">First Name</span>
                            <input 
                                value={context.data.firstName} 
                                onChange={e => context.updateData({firstName: e.target.value})} 
                                type="text" 
                                required placeholder="First Name" className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-dark-gray">Last Name</span>
                            <input 
                                value={context.data.lastName} 
                                onChange={e => context.updateData({lastName: e.target.value})}
                                type="text" 
                                required 
                                placeholder="Last Name" 
                                className="py-2 px-3 border-[1px] rounded-lg"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Company Name</span>
                        <input 
                            value={context.data.company || ""}
                            onChange={e => context.updateData({company: e.target.value})}
                            type="text" 
                            placeholder="Company (Optional)" 
                            className="py-2 px-3 border-[1px] rounded-lg"
                            />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Email Address</span>
                        <input 
                            value={context.data.email}
                            onChange={e => context.updateData({email: e.target.value})} 
                            type="email" 
                            placeholder="Email" 
                            required
                            className="py-2 px-3 border-[1px] rounded-lg"
                        />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-dark-gray">Phone Number</span>
                        <input 
                            value={context.data.phone} 
                            onChange={e => handlePhoneChanged(e)}
                            type="tel" 
                            pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}"
                            maxLength={13}
                            placeholder="Phone" 
                            className="py-2 px-3 border-[1px] rounded-lg"
                        />
                    </div>
                    <div className="flex items-center justify-between my-2 gap-x-4">
                        <span>I consent to & prefer being contacted through:</span>
                        <select
                            value={context.data.preferences} 
                            onChange={e => context.updateData({preferences: e.target.value as PreferencesType})}
                            className="border-b-[1px] py-2 pr-10 outline-none"
                        >
                            <option value="Email">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="Phone">Phone</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}