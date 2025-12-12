import { PathLink } from "@/app/components/base/PathLink";
import Input, { Dropdown } from "@/app/components/dashboard/Input";
import useFormContext from "@/app/context/useFormContext";
import { BillingMethod } from "@/app/utils/types/pitch";
import z from "zod"

export const settingsSchema = z.object({
    automaticBookings: z.enum(["Yes", "No"], "Automatic booking setting is required.")
        .transform((val) => val === "Yes"),
    paymentDeadline: z.string()
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 24, {
            message: "Payment deadline must either be between 0 and 24 hours.",
        }),
    depositFee: z.string()
        .trim()
        .transform((val) => (val === "" ? null : Number(val)))
        .refine(
            (val) => val === null || (Number.isInteger(val) && val >= 10 && val <= 50),
            "Deposit percentage must be between 10 and 50, or left empty."
        )
        .nullable(),
    minBookingHours: z.string("Minimum booking hours is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 1 && val <= 4, {
            message: "Minimum booking hours must be between 1 and 4 hours.",
        }),
    maxBookingHours: z.string("Maximum booking hours is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 2 && val <= 5, {
            message: "Maximum booking hours must be between 2 and 5 hours.",
        }),
    cancellationFee: z.string("Cancellation fee is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 50, {
            message: "Cancellation fee must be between 0 and 50 percent.",
        }),
    noShowFee: z.string("No show fee is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 100, {
            message: "No show fee must be between 0 and 100 percent.",
        }),
    advanceBooking: z.string("Advance booking hours is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 23, {
            message: "Advance booking hours must be between 0 and 23 hours.",
        }),
    peakHourSurcharge: z.string("Peak hour surcharge is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 50, {
            message: "Peak hour surcharge must be between 0 and 50 percent.",
        }),
    offPeakDiscount: z.string("Off peak discount is required.")
        .min(1, "This field is required.")
        .transform(Number)
        .refine((val) => Number.isInteger(val) && val >= 0 && val <= 50, {
            message: "Off peak discount must be between 0 and 50 percent.",
        }),
    payoutRate: z.enum(["BIWEEKLY", "MONTHLY"], "Payout rate is required."),
    paymentMethods: z.array(z.enum(["CREDIT_CARD", "WALLET", "CASH"], "Allowed payment method is required."))
        .min(1, "At least one method is required to allow users to book your pitch.")
        .max(3, "3 payment methods allowed at most.")
        .refine((arr) => new Set(arr).size === arr.length, "Payment methods must be unique.")
}).superRefine((data, ctx) => {
    if (data.minBookingHours > data.maxBookingHours) {
        ctx.addIssue({
            code: "custom",
            path: ["maxBookingHours"],
            message: "Maximum booking hours must be greater than minimum booking hours."
        });
    };

    if (data.advanceBooking >= data.paymentDeadline) {
        ctx.addIssue({
            code: "custom",
            path: ["paymentDeadline"],
            message: "Payment deadline must always be greater than hours before booking."
        });
    };
});

export default function Settings() {
    const { formData, setFormData, errors } = useFormContext();

    const togglePaymentMethod = (method: BillingMethod) => {
        setFormData({
            ...formData,
            settings: {
                ...formData.settings,
                paymentMethods: formData.settings.paymentMethods.includes(method)
                    ? formData.settings.paymentMethods.filter((m: BillingMethod) => m !== method)
                    : [...formData.settings.paymentMethods, method],
            },
        });
    };

    return (
        <>
            <div className="flex items-start w-[calc(50%-0.5rem)]">
                <Dropdown label="Automatic Booking" 
                    options={[
                        { value: "Yes", label: "Yes" },
                        { value: "No", label: "No" },
                    ]} 
                    description="Manually select which bookings to approve. Turning this off will require a lot more effort to maintain and may lower your rating if you fail to do so."
                    value={formData.settings.automaticBookings}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, automaticBookings: e.target.value } })}
                    required 
                />
            </div>
            <div className="flex items-start my-4 w-[calc(50%-0.5rem)]">
                <Input 
                    label="Payment Deadline" 
                    placeholder="Payment Deadline" 
                    description="Set the payment (full or deposit) deadline in hours before the booking start time. This must always be more than the hours before booking value if set. Does not apply if cash is payment method."
                    value={formData.settings.paymentDeadline}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, paymentDeadline: e.target.value} })}
                    error={errors?.["settings.paymentDeadline"]}
                    unit={formData.settings.paymentDeadline === "1" ? "Hour" : "Hours"}
                />
            </div>
            <div className={formData.settings.allowDeposit === "Yes" ? "flex items-start gap-x-4 my-4" : "flex items-start my-4 w-[calc(50%-0.5rem)]"}>
                <Dropdown 
                    label="Allow Deposit?"
                    options={[
                        { value: "No", label: "No" },
                        { value: "Yes", label: "Yes" },
                    ]}
                    value={formData.settings.allowDeposit}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, allowDeposit: e.target.value} })}
                />
                {
                    formData.settings.allowDeposit === "Yes" &&
                    <Input 
                        label="Deposit Fee" 
                        placeholder="Deposit (in %)" 
                        description="Set the deposit fee as a percentage of the booking price."
                        value={formData.settings.depositFee}
                        onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, depositFee: e.target.value} })}
                        error={errors?.["settings.depositFee"]}
                        unit="%"
                    />
                }
            </div>
            <div className="flex items-start my-4 w-[calc(50%-0.5rem)]">
                <Input 
                    label="Hours Before Booking" 
                    placeholder="Advance Booking" 
                    description="Make sure a user can only book at least X hours prior to the time." 
                    required
                    value={formData.settings.advanceBooking}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, advanceBooking: e.target.value} })}
                    error={errors?.["settings.advanceBooking"]}
                    unit={formData.settings.advanceBooking === "1" ? "Hour" : "Hours"}
                />
            </div>
            <div className="flex items-start gap-x-4 my-4">
                <Input 
                    label="Minimum Booking Hours" 
                    placeholder="Minimum Hours" 
                    description="Set the minimum hours for a booking. (e.g: Book for 1 hour at least)" 
                    required
                    value={formData.settings.minBookingHours}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, minBookingHours: e.target.value} })}
                    error={errors?.["settings.minBookingHours"]}
                    unit={formData.settings.minBookingHours === "1" ? "Hour" : "Hours"}
                />
                <Input 
                    label="Maximum Booking Hours" 
                    placeholder="Maximum Hours" 
                    description="Set the maximum hours for a booking. (e.g: Book for 5 hours at most)" 
                    required
                    value={formData.settings.maxBookingHours}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, maxBookingHours: e.target.value} })}
                    error={errors?.["settings.maxBookingHours"]}
                    unit={formData.settings.maxBookingHours === "1" ? "Hour" : "Hours"}
                />
            </div>
            <div className="flex items-start gap-x-4 my-4">
                <Input 
                    label="Cancellation Fee" 
                    placeholder="Cancellation Fee (in %)" 
                    description="Set the cancellation fee as a percentage of the booking price."
                    required
                    value={formData.settings.cancellationFee}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, cancellationFee: e.target.value} })}
                    error={errors?.["settings.cancellationFee"]}
                    unit="%"
                />
                <Input 
                    label="No Show Fee" 
                    placeholder="No Show Fee (in %)" 
                    description="Set the no show fee as a percentage of the booking price."
                    required
                    value={formData.settings.noShowFee}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, noShowFee: e.target.value} })}
                    error={errors?.["settings.noShowFee"]}
                    unit="%"
                />
            </div>
            <div className="flex items-start gap-x-4 my-4">
                <Input 
                    label="Peak Hour Surcharge" 
                    placeholder="Surcharge (in %)" 
                    description="Set a surcharge factor for peak hour bookings. You'll be able to set which hours this applies to in the next step." 
                    required
                    value={formData.settings.peakHourSurcharge}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, peakHourSurcharge: e.target.value} })}
                    error={errors?.["settings.peakHourSurcharge"]}
                    unit="%"
                />
                <Input 
                    label="Off Peak Discount" 
                    placeholder="Discount (in %)" 
                    description="Set a discount factor for off-peak hour bookings. You'll be able to set which hours this applies to in the next step." 
                    required
                    value={formData.settings.offPeakDiscount}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, offPeakDiscount: e.target.value} })}
                    error={errors?.["settings.offPeakDiscount"]}
                    unit="%"
                />
            </div>
            <div className="flex flex-col gap-y-2 items-start w-[calc(50%-0.5rem)] my-4">
                <span className="font-medium text-gray-700">
                    Payment Methods
                    <span className="text-red-500 ml-0.5">*</span>
                </span>
                <div className="flex items-center gap-x-2 text-xs">
                    <PathLink 
                        title="Cash" 
                        onClick={() => togglePaymentMethod("CASH")} 
                        isSelected={formData.settings.paymentMethods.includes("CASH")}
                    />
                    <PathLink 
                        title="Credit Card" 
                        onClick={() => togglePaymentMethod("CREDIT_CARD")} 
                        isSelected={formData.settings.paymentMethods.includes("CREDIT_CARD")}
                    />
                    <PathLink 
                        title="Wallet"
                        onClick={() => togglePaymentMethod("WALLET")} 
                        isSelected={formData.settings.paymentMethods.includes("WALLET")}
                    />
                </div>
                {errors?.["settings.paymentMethods"] && <p className="text-red-500 text-xs">{errors?.["settings.paymentMethods"]}</p>}
            </div>
            <div className="flex items-start w-[calc(50%-0.5rem)] my-4">
                <Dropdown 
                    label="Payout Rate" 
                    options={[
                        { value: "MONTHLY", label: "Monthly" },
                        { value: "BIWEEKLY", label: "Biweekly" },
                    ]} 
                    required 
                    description="A member of the Hagz team will deliver your payout on this schedule."
                    value={formData.settings.payoutRate}
                    onChange={(e) => setFormData({ ...formData, settings: {...formData.settings, payoutRate: e.target.value} })}
                />
            </div>
        </>
    )
};