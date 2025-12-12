import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import z from "zod";
import { v4 as randomUUID } from "uuid";

import useFormContext from "@/app/context/useFormContext";
import Input from "@/app/components/dashboard/Input";
import { PathLink } from "@/app/components/base/PathLink";
import { CombinationType, GroundType } from "@/app/dashboard/pitches/create/steps/Layout";
import { createCombinationKey, doesCombinationExist } from "@/app/utils/layout";

import { IoGridOutline, IoSettingsOutline } from "react-icons/io5";
import { IoIosClose, IoIosInformationCircleOutline, IoMdPeople } from "react-icons/io";
import { CgDetailsMore } from "react-icons/cg";
import { MdEmojiPeople } from "react-icons/md";
import { LuLayoutDashboard } from "react-icons/lu";
import { FaPeopleGroup } from "react-icons/fa6";

// Start of combinationModal steps
const CombinationModalGrounds = ({ 
    setName, 
    setPrice, 
    grounds, 
    setGrounds, 
    errors 
} : { 
    setName: (name: string) => void, 
    setPrice: (price: string) => void,
    grounds: Array<string>, 
    setGrounds: (grounds: Array<string>) => void, 
    errors: Record<string, string> 
}) => {
    const { formData } = useFormContext();

    const options = formData.layout.grounds;

    const handleSelectGround = (id: string) => {
        let newGrounds: string[];

        if (grounds.includes(id)) {
            newGrounds = grounds.filter((groundId: string) => groundId !== id);
        } else {
            newGrounds = [...grounds, id];
        };

        const ordered = options.map((g: GroundType) => g.id);
        newGrounds.sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b));

        setGrounds(newGrounds);

        const selectedNames = newGrounds
            .map((groundId) => options.find((g: GroundType) => g.id === groundId).name)
            .filter(Boolean);

        if (selectedNames.length === 0) {
            setName("Default Combination");
        } else {
            setName(selectedNames.join(" + "));
        };

        const selectedPrices = newGrounds
            .map((groundId) => parseFloat(options.find((g: GroundType) => g.id === groundId).price))
            .filter(Boolean);

        const priceSum = selectedPrices.reduce((acc, curr) => acc + curr, 0);

        if (selectedPrices.length === 0) {
            setPrice("0");
        } else {
            setPrice(priceSum.toString());
        }
    };

    return (
        <>
            {
                errors['grounds'] &&
                <p className="text-red-500 text-[0.8rem] mb-4">{errors['grounds']}</p>
            }
            <h6 className="text-[0.8125rem] mb-1">Notes:</h6>
            <ul className="text-[0.8rem] mb-6 list-disc px-4 [&>li]:mb-1 text-gray-600">
                <li>You can not include an <span className="underline">11-a-side</span> ground within a combination.</li>
                <li>You can not combine grounds with <span className="underline">different surface types.</span></li>
            </ul>
            <div className="grid grid-cols-3 gap-x-4 gap-y-3 h-[calc(100%-2.5rem)] overflow-y-auto rounded-md border-[1px] border-gray-200 p-3">
                {
                    options.length > 0 ? 
                    options.map((option: CombinationType) => {
                        return (
                            <button type="button" key={option.id} onClick={() => handleSelectGround(option.id)} className={`border-[1px] cursor-pointer text-xs transition-all rounded-md p-2 ${grounds.includes(option.id) ? 'bg-blue-700 text-white' : 'bg-white border-gray-200 text-black'}`}>
                                {option.name}
                            </button>
                        )
                    }) :
                    <p className="text-sm text-gray-600 col-span-3 text-center">You have no grounds available. Please add grounds first.</p>
                }
            </div>
        </>
    )
};

const CombinationModalSize = ({ size, setSize } : { size: "SEVEN" | "NINE" | "ELEVEN", setSize: (value: "SEVEN" | "NINE" | "ELEVEN") => void }) => {
    const sizeMap = new Map<string, number>([
        ["SEVEN", 0],
        ["NINE", 1],
        ["ELEVEN", 2]
    ]);

    const options = [
        {
            label: "Seven-a-side",
            value: "SEVEN",
            icon: <IoMdPeople className="size-5"/>,
            description: "Medium-sized ground. Suitable for a capacity of up to 14 players.",
            analysis: "A medium-sized ground suitable for seven-a-side games. This can also be combined/upscaled to larger sizes."
        },
        {
            label: "Nine-a-side",
            value: "NINE",
            icon: <IoMdPeople className="size-5"/>,
            description: "Medium-sized ground. Takes up to 18 players.",
            analysis: "A medium-sized ground suitable for nine-a-side games. This can also be combined/upscaled to larger sizes."
        },
        {
            label: "Eleven-a-side",
            value: "ELEVEN",
            icon: <FaPeopleGroup className="size-5"/>,
            description: "The largest ground. Suitable for a capacity of up to 22 players.",
            analysis: "A large-sized ground suitable for full-sized games."
        }
    ];

    return (
        <>
            <div className="flex flex-col gap-y-4">
                {
                    options.map((option, index) => {
                        return (
                            <div key={index} className="w-full text-[0.8rem]">
                                <PathLink isSelected={index === sizeMap.get(size)} icon={option.icon} title={option.label} description={option.description} className="w-full!" onClick={() => setSize(option.value as "SEVEN" | "NINE" | "ELEVEN")} />
                            </div>
                        )
                    })
                }
            </div>
            <p className="text-[0.8125rem] my-6 text-gray-600">{options[sizeMap.get(size)!].analysis}</p>
        </>
    )
};

const CombinationModalDetails = ({
    name,
    price,
    description,
    setName,
    setPrice,
    setDescription,
    errors
} : {
    name: string,
    price: string,
    description: string,
    setName: (value: string) => void,
    setPrice: (value: string) => void,
    setDescription: (value: string) => void,
    errors: Record<string, string>
}) => {
    return (
        <div className="flex flex-col gap-y-4 text-xs">
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="Combination Name" 
                        description="Defaults to 'Ground A + Ground B' normally."
                        error={errors?.["details.name"]}
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Combined Price" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)} 
                        placeholder="Price" 
                        description="Ground prices sum specified by default."
                        error={errors?.["details.price"]}
                        unit="EGP"
                    />
                </div>
            </div>
            <div className="flex flex-1 flex-col gap-y-1.5">
                <Input
                    label="Additional Description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Description" 
                    description="Pitch base description specified previously will be used by default. Only use this field for combination-specific information."
                    error={errors?.["details.description"]}
                />
            </div>
        </div>
    )
};

const CombinationModalSettings = ({ 
    minimumHours, 
    setMinimumHours, 
    maximumHours, 
    setMaximumHours,
    cancellationFee,
    setCancellationFee,
    noShowFee,
    setNoShowFee,
    paymentDeadline,
    setPaymentDeadline,
    advanceBooking,
    setAdvanceBooking,
    peakHourSurcharge,
    setPeakHourSurcharge,
    offPeakDiscount,
    setOffPeakDiscount,
    errors
} : { 
    minimumHours: string, 
    setMinimumHours: (value: string) => void, 
    maximumHours: string, 
    setMaximumHours: (value: string) => void,
    cancellationFee: string,
    setCancellationFee: (value: string) => void,
    noShowFee: string,
    setNoShowFee: (value: string) => void,
    paymentDeadline: string,
    setPaymentDeadline: (value: string) => void,
    advanceBooking: string,
    setAdvanceBooking: (value: string) => void,
    peakHourSurcharge: string,
    setPeakHourSurcharge: (value: string) => void,
    offPeakDiscount: string,
    setOffPeakDiscount: (value: string) => void,
    errors: Record<string, string>
}) => {
    return (
        <div className="flex flex-col gap-y-4 text-xs mt-4 mb-8">
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Minimum Booking Hours" 
                        value={minimumHours} 
                        description="Override the default pitch minimum booking hours." 
                        onChange={(e) => setMinimumHours(e.target.value)} 
                        placeholder="Minimum Hours" 
                        error={errors?.["settings.minimumHours"]}
                        unit="hours"
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Maximum Booking Hours" 
                        value={maximumHours} 
                        description="Override the default pitch maximum booking hours." 
                        onChange={(e) => setMaximumHours(e.target.value)} 
                        placeholder="Maximum Hours" 
                        error={errors?.["settings.maximumHours"]} 
                        unit="hours"
                    />
                </div>
            </div>
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Cancellation Fee" 
                        value={cancellationFee} 
                        description="Override the default pitch cancellation fee." 
                        onChange={(e) => setCancellationFee(e.target.value)} 
                        placeholder="Cancellation Fee" 
                        error={errors?.["settings.cancellationFee"]} 
                        unit="%"
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="No Show Fee" 
                        value={noShowFee} 
                        description="Override the default pitch no show fee." 
                        onChange={(e) => setNoShowFee(e.target.value)} 
                        placeholder="No Show Fee" 
                        error={errors?.["settings.noShowFee"]} 
                        unit="%"
                    />
                </div>
            </div>
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Payment Deadline" 
                        value={paymentDeadline}
                        onChange={(e) => setPaymentDeadline(e.target.value)} 
                        placeholder="Payment Deadline" 
                        error={errors?.["settings.paymentDeadline"]}
                        unit="hours"
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Hours Before Booking" 
                        value={advanceBooking}
                        onChange={(e) => setAdvanceBooking(e.target.value)} 
                        placeholder="Hours Before Booking" 
                        error={errors?.["settings.advanceBooking"]}
                        unit="hours"
                    />
                </div>
            </div>
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                        <Input 
                            label="Peak Hour Surcharge" 
                            value={peakHourSurcharge} 
                            description="Override the default pitch peak hour surcharge percentage." 
                            onChange={(e) => setPeakHourSurcharge(e.target.value)} 
                            placeholder="Peak Hour Surcharge" 
                            error={errors?.["settings.peakHourSurcharge"]} 
                            unit="%"
                        />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Off Peak Discount" 
                        value={offPeakDiscount} 
                        description="Override the default pitch off peak discount percentage." 
                        onChange={(e) => setOffPeakDiscount(e.target.value)} 
                        placeholder="Off Peak Discount" 
                        error={errors?.["settings.offPeakDiscount"]} 
                        unit="%"
                    />
                </div>
            </div>
        </div>
    )
};

// Start of addCombinationModal component
export const AddCombinationModal = ({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) => {
    const { formData, setFormData } = useFormContext();

    const [currentIndex, setCurrentIndex] = useState(0);

    const [grounds, setGrounds] = useState<Array<string>>([]);

    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [description, setDescription] = useState("");

    const [size, setSize] = useState<"SEVEN" | "NINE" | "ELEVEN">("SEVEN");

    const [minimumHours, setMinimumHours] = useState(formData.settings.minBookingHours);
    const [maximumHours, setMaximumHours] = useState(formData.settings.maxBookingHours);
    const [cancellationFee, setCancellationFee] = useState(formData.settings.cancellationFee);
    const [noShowFee, setNoShowFee] = useState(formData.settings.noShowFee);
    const [paymentDeadline, setPaymentDeadline] = useState(formData.settings.paymentDeadline);
    const [advanceBooking, setAdvanceBooking] = useState(formData.settings.advanceBooking);
    const [peakHourSurcharge, setPeakHourSurcharge] = useState(formData.settings.peakHourSurcharge);
    const [offPeakDiscount, setOffPeakDiscount] = useState(formData.settings.offPeakDiscount);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 3000);
    };
    
    const addCombinationModalGroundsProps = {
        setName,
        setPrice,
        grounds,
        setGrounds
    }

    const addCombinationModalDetailsProps = {
        name,
        price,
        description,
        setName,
        setPrice,
        setDescription
    }

    const addCombinationModalSettingsProps = {
        minimumHours,
        maximumHours,
        setMinimumHours,
        setMaximumHours,
        cancellationFee,
        setCancellationFee,
        noShowFee,
        setNoShowFee,
        paymentDeadline,
        setPaymentDeadline,
        advanceBooking,
        setAdvanceBooking,
        peakHourSurcharge,
        setPeakHourSurcharge,
        offPeakDiscount,
        setOffPeakDiscount
    };
    const steps = [
        {
            label: "Grounds",
            icon: <LuLayoutDashboard className="size-3.5"/>,
            title: "Link Grounds",
            description: "Select grounds for the combination.",
            component: <CombinationModalGrounds {...addCombinationModalGroundsProps} errors={errors}/>
        },
        {
            label: "Size",
            icon: <MdEmojiPeople className="size-3.5"/>,
            title: "Combination Size",
            description: "Select the size for the combination.",
            component: <CombinationModalSize size={size} setSize={setSize}/>
        },
        {
            label: "Details",
            icon: <CgDetailsMore className="size-3.5"/>,
            title: "Combination Details",
            description: "Provide details for the combination.",
            component: <CombinationModalDetails {...addCombinationModalDetailsProps} errors={errors}/>
        },
        {
            label: "Settings",
            icon: <IoSettingsOutline className="size-3.5"/>,
            title: "Combination Settings",
            description: "Provide settings for the combination.",
            component: <CombinationModalSettings {...addCombinationModalSettingsProps} errors={errors}/>
        }
    ];

    const validateData = () => {
        switch (currentIndex) {
            case 0:
                {
                    const schema = z.object({
                        grounds: z.array(z.uuid()).min(2, "You need at least 2 grounds to create a combination.").max(5, "You can select up to 5 grounds at most to create a combination.")
                    });

                    const parsed = schema.safeParse({
                        grounds
                    });

                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };

                    const hasEleven = formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id) && ground.size == "ELEVEN");

                    if (hasEleven.length > 0) {
                        setErrorsWithTimeout({ grounds: "You cannot include an 11-a-side ground in a combination." });
                        return false;
                    }

                    const hasDifferentSurfaceTypes = new Set(formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id)).map((ground: GroundType) => ground.surfaceType));

                    if (hasDifferentSurfaceTypes.size > 1) {
                        setErrorsWithTimeout({ grounds: "You cannot combine grounds with different surface types." });
                        return false;
                    }

                    const targetKey = createCombinationKey(grounds);
                    const exists = doesCombinationExist(targetKey, formData.layout.combinations);

                    if (exists) {
                        setErrorsWithTimeout({ grounds: "A combination with the selected grounds already exists." });
                        return false;
                    }

                    return true;
                }
            case 1:
                return true;
            case 2:
                {
                    const groundNames = formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id)).map((ground: GroundType) => ground.name);
                    const defaultName = groundNames.length > 0 ? `${groundNames.join(" + ")}` : `Combination ${String.fromCharCode(65 + formData.layout.combinations.length)}`;

                    const schema = z.object({
                        name: z.string()
                            .transform(val => val.trim() === "" ? undefined : val) // turn "" into undefined
                            .optional()
                            .default(defaultName)
                            .refine(val => val.length >= 2, {
                                message: "Ground name must be at least 2 characters long.",
                            })
                            .refine(val => val.length <= 50, {
                                message: "Ground name must be 50 characters long at most.",
                            }),
                        price: z.string("Ground price is required.")
                            .min(2, "This field is required.")
                            .transform(Number)
                            .refine((val) => val >= 100 && val <= 6000, {
                                message: "Ground price must be between 100 and 6000 EGP per hour.",
                            }),
                        description: z.string()
                            .max(500, "Additional description may not be longer than 500 characters.")
                            .trim()
                            .transform((val) => (val === "" ? null : val))
                    })

                    const parsed = schema.safeParse({
                        name,
                        price,
                        description
                    })

                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`details.${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };

                    setName(parsed.data.name);
                    return true;
                }
            case 3:
                {
                    const schema = z.object({
                        minimumHours: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 1 && val <= 4), {
                                message: "Minimum booking hours must be between 1 and 4 hours.",
                            }),
                        maximumHours: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 2 && val <= 5), {
                                message: "Maximum booking hours must be between 2 and 5 hours.",
                            }),
                        cancellationFee: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Cancellation fee must be between 0 and 50 percent.",
                            }),
                        noShowFee: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 100), {
                                message: "No show fee must be between 0 and 100 percent.",
                            }),
                        paymentDeadline: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 2 && val <= 24), {
                                message: "Payment deadline must be between 2 and 24 hours.",
                            }),
                        advanceBooking: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 1 && val <= 23), {
                                message: "Advance booking hours must be between 1 and 23 hours.",
                            }),
                        peakHourSurcharge: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Peak hour surcharge must be between 0 and 50 percent.",
                            }),
                        offPeakDiscount: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Off peak discount must be between 0 and 50 percent.",
                            }),
                    }).superRefine((_, ctx) => {
                        if (minimumHours >= maximumHours) {
                            ctx.addIssue({
                                code: "custom",
                                path: ["minimumHours"],
                                message: "Minimum booking hours must be less than maximum booking hours.",
                            });
                        };

                        if (advanceBooking >= paymentDeadline) {
                            ctx.addIssue({
                                code: "custom",
                                path: ["paymentDeadline"],
                                message: "Payment must happen before the hours before booking.",
                            });
                        };
                    });
    
                    const parsed = schema.safeParse({
                        minimumHours,
                        maximumHours,
                        cancellationFee,
                        noShowFee,
                        paymentDeadline,
                        advanceBooking,
                        peakHourSurcharge,
                        offPeakDiscount
                    });
    
                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`settings.${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };
    
                    return true;   
                }
        }
    }

    const next = () => {
        // Implement a function to validate the current step before proceeding
        const parsed = validateData();

        if (parsed && currentIndex < steps.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const previous = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const clearData = () => {
        setGrounds([]);

        setName("");
        setPrice(formData.settings.basePrice);
        setDescription("");

        setSize("SEVEN");

        setMinimumHours(formData.settings.minBookingHours);
        setMaximumHours(formData.settings.maxBookingHours);
        setCancellationFee(formData.settings.cancellationFee);
        setNoShowFee(formData.settings.noShowFee);
        setPaymentDeadline(formData.settings.paymentDeadline);
        setAdvanceBooking(formData.settings.advanceBooking);
        setPeakHourSurcharge(formData.settings.peakHourSurcharge);
        setOffPeakDiscount(formData.settings.offPeakDiscount);
    };

    const handleCreateCombination = () => {
        // TODO: Implement a function to clear the state back to default values when the creation is successful.
        const parsed = validateData();
        if (!parsed) return;

        clearData();
        setCurrentIndex(0);

        const id = randomUUID();

        const surfaceType = formData.layout.grounds.find((ground: GroundType) => ground.id === grounds[0]).surfaceType;
        const defaultSettings = formData.settings;

        const combination = {
            grounds,
            id,
            name,
            price,
            description,
            size,
            surfaceType,
            settings: {
                minBookingHours:
                    minimumHours !== defaultSettings.minBookingHours ? minimumHours : null,
                maxBookingHours:
                    maximumHours !== defaultSettings.maxBookingHours ? maximumHours : null,
                cancellationFee:
                    cancellationFee !== defaultSettings.cancellationFee ? cancellationFee : null,
                noShowFee:
                    noShowFee !== defaultSettings.noShowFee ? noShowFee : null,
                paymentDeadline:
                    paymentDeadline !== defaultSettings.paymentDeadline ? paymentDeadline : null,
                advanceBooking:
                    advanceBooking !== defaultSettings.advanceBooking ? advanceBooking : null,
                peakHourSurcharge:
                    peakHourSurcharge !== defaultSettings.peakHourSurcharge ? peakHourSurcharge : null,
                offPeakDiscount:
                    offPeakDiscount !== defaultSettings.offPeakDiscount ? offPeakDiscount : null
            }
        };

        setFormData({
            ...formData,
            layout: {
                ...formData.layout,
                combinations: [
                    ...formData.layout.combinations,
                    combination
                ]
            }
        });

        onClose();
    };

    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="modal fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
                    <div className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="px-2 py-3 flex flex-col justify-between gap-y-32 w-60">
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-x-2.5">
                                        <IoGridOutline className="size-4 text-black text-[0.825rem]"/>
                                        <span className="font-medium">Add Combination</span>
                                    </div>
                                    <div className="relative">
                                        <IoIosInformationCircleOutline className="size-4.5 text-gray-500"/>
                                    </div>
                                </div>
                                <div className="my-6">
                                    <p className="text-[0.8125rem] text-gray-600">
                                        Combinations allow you to group grounds that can be merged together, making it easier to manage and present them as a cohesive unit.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-y-1">
                                    {
                                        steps.map((step, index) => {
                                            const isComplete = index < currentIndex;
                                            const isActive = index === currentIndex;

                                            return (
                                                <div className="p-2 flex items-center gap-x-2 rounded-md" style={isActive ? { background: "#e5e7eb" } : (isComplete ? {} : { color: "#6a7282" })} key={index}>
                                                    {step.icon}
                                                    <span className="font-medium text-[0.8125rem]">{step.label}</span>
                                                </div>
                                            )
                                        })
                                    }
                                </div>
                            </div>
                            <div className="flex flex-col gap-y-2.5">
                                <span className="text-[0.8125rem] text-gray-700">Step {currentIndex + 1} of {steps.length}</span>
                                <div className="bg-blue-200 w-full relative h-1 rounded-md overflow-clip">
                                    <div className="absolute h-full bg-blue-700" style={{ width: `${(currentIndex + 1) / steps.length * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-md p-5 flex flex-col justify-between bg-white border-[1px] border-gray-300 w-lg">
                            <div className="flex-1">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-1 flex-col gap-y-0.5">
                                        <h2 className="font-medium text-sm">{steps[currentIndex].title}</h2>
                                        <p className="text-[0.8rem] text-gray-600 max-w-3/4">{steps[currentIndex].description}</p>
                                    </div>
                                    <button className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer" type="button" onClick={onClose}>
                                        <IoIosClose className="size-6"/>
                                    </button>
                                </div>
                                <div className="mt-5 mb-6">
                                    {steps[currentIndex].component}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-x-2">
                                {
                                    currentIndex != 0 &&
                                    <button type="button" onClick={previous} className="flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2 border-gray-300 bg-white transition-colors cursor-pointer">
                                        <span className="text-xs">Previous</span>
                                    </button>
                                }
                                {
                                    currentIndex != steps.length - 1 ?
                                    <button type="button" onClick={next} className="flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                        <span className="text-xs">Next</span>
                                    </button> :
                                    <button type="button" onClick={handleCreateCombination} className="flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                        <span className="text-xs">Create</span>
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
}

// Start of editCombinationModal component
export const EditCombinationModal = ({ isOpen, onClose, target } : { isOpen: boolean, onClose: () => void, target: string }) => {
    const { formData, setFormData } = useFormContext();

    const combination = formData.layout.combinations.find((combination: CombinationType) => combination.id === target);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [grounds, setGrounds] = useState(combination.grounds);

    const [name, setName] = useState(combination.name);
    const [price, setPrice] = useState(combination.price);
    const [description, setDescription] = useState(combination.description ?? "");

    const [size, setSize] = useState(combination.size);

    const [minimumHours, setMinimumHours] = useState(combination.settings.minBookingHours ?? formData.settings.minBookingHours);
    const [maximumHours, setMaximumHours] = useState(combination.settings.maxBookingHours ?? formData.settings.maxBookingHours);
    const [cancellationFee, setCancellationFee] = useState(combination.settings.cancellationFee ?? formData.settings.cancellationFee);
    const [noShowFee, setNoShowFee] = useState(combination.settings.noShowFee ?? formData.settings.noShowFee);
    const [paymentDeadline, setPaymentDeadline] = useState(combination.settings.paymentDeadline ?? formData.settings.paymentDeadline);
    const [advanceBooking, setAdvanceBooking] = useState(combination.settings.advanceBooking ?? formData.settings.advanceBooking);
    const [peakHourSurcharge, setPeakHourSurcharge] = useState(combination.settings.peakHourSurcharge ?? formData.settings.peakHourSurcharge);
    const [offPeakDiscount, setOffPeakDiscount] = useState(combination.settings.offPeakDiscount ?? formData.settings.offPeakDiscount);

    const setErrorsWithTimeout = (data: Record<string, string>) => {
        setErrors(data);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setErrors({}), 3000);
    };

    const editCombinationModalGroundsProps = {
        setName,
        setPrice,
        grounds,
        setGrounds
    };

    const editCombinationModalDetailsProps = {
        name,
        price,
        description,
        setName,
        setPrice,
        setDescription
    };

    const editCombinationModalSettingsProps = {
        minimumHours,
        maximumHours,
        setMinimumHours,
        setMaximumHours,
        cancellationFee,
        setCancellationFee,
        noShowFee,
        setNoShowFee,
        paymentDeadline,
        setPaymentDeadline,
        advanceBooking,
        setAdvanceBooking,
        peakHourSurcharge,
        setPeakHourSurcharge,
        offPeakDiscount,
        setOffPeakDiscount
    };

    const steps = [
        {
            label: "Grounds",
            icon: <LuLayoutDashboard className="size-3.5" />,
            title: "Edit Grounds",
            description: "Update the grounds linked to this combination.",
            component: <CombinationModalGrounds {...editCombinationModalGroundsProps} errors={errors} />
        },
        {
            label: "Size",
            icon: <MdEmojiPeople className="size-3.5" />,
            title: "Edit Size",
            description: "Change the size of the combination.",
            component: <CombinationModalSize size={size} setSize={setSize} />
        },
        {
            label: "Details",
            icon: <CgDetailsMore className="size-3.5" />,
            title: "Edit Details",
            description: "Update name, price, and description.",
            component: <CombinationModalDetails {...editCombinationModalDetailsProps} errors={errors}/>
        },
        {
            label: "Settings",
            icon: <IoSettingsOutline className="size-3.5" />,
            title: "Edit Settings",
            description: "Override default pitch settings if needed.",
            component: <CombinationModalSettings {...editCombinationModalSettingsProps} errors={errors} />
        }
    ];

    const validateData = () => {
        switch (currentIndex) {
            case 0:
                {
                    const schema = z.object({
                        grounds: z.array(z.uuid()).min(2, "You need at least 2 grounds to create a combination.").max(5, "You can select up to 5 grounds at most to create a combination.")
                    });

                    const parsed = schema.safeParse({
                        grounds
                    });

                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };

                    const hasEleven = formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id) && ground.size == "ELEVEN");

                    if (hasEleven.length > 0) {
                        setErrorsWithTimeout({ grounds: "You cannot include an 11-a-side ground in a combination." });
                        return false;
                    }

                    const hasDifferentSurfaceTypes = new Set(formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id)).map((ground: GroundType) => ground.surfaceType));

                    if (hasDifferentSurfaceTypes.size > 1) {
                        setErrorsWithTimeout({ grounds: "You cannot combine grounds with different surface types." });
                        return false;
                    }

                    const targetKey = createCombinationKey(grounds);
                    const exists = formData.layout.combinations.some(
                        (combination: CombinationType) => createCombinationKey(combination.grounds) === targetKey && combination.id !== target
                    );

                    if (exists) {
                        setErrorsWithTimeout({ grounds: "A combination with the selected grounds already exists." });
                        return false;
                    }

                    return true;
                }
            case 1:
                return true;
            case 2:
                {
                    const groundNames = formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id)).map((ground: GroundType) => ground.name);
                    const defaultName = groundNames.length > 0 ? `${groundNames.join(" + ")}` : `Combination ${String.fromCharCode(65 + formData.layout.combinations.length)}`;

                    const schema = z.object({
                        name: z.string()
                            .transform(val => val.trim() === "" ? undefined : val) // turn "" into undefined
                            .optional()
                            .default(defaultName)
                            .refine(val => val.length >= 2, {
                                message: "Ground name must be at least 2 characters long.",
                            })
                            .refine(val => val.length <= 50, {
                                message: "Ground name must be 50 characters long at most.",
                            }),
                        price: z.string("Ground price is required.")
                            .min(2, "This field is required.")
                            .transform(Number)
                            .refine((val) => val >= 100 && val <= 6000, {
                                message: "Ground price must be between 100 and 6000 EGP per hour.",
                            }),
                        description: z.string()
                            .max(500, "Additional description may not be longer than 500 characters.")
                            .trim()
                            .transform((val) => (val === "" ? null : val))
                    })

                    const parsed = schema.safeParse({
                        name,
                        price,
                        description
                    })

                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`details.${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };

                    setName(parsed.data.name);
                    return true;
                }
            case 3:
                {
                    const schema = z.object({
                        minimumHours: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 1 && val <= 4), {
                                message: "Minimum booking hours must be between 1 and 4 hours.",
                            }),
                        maximumHours: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 2 && val <= 5), {
                                message: "Maximum booking hours must be between 2 and 5 hours.",
                            }),
                        cancellationFee: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Cancellation fee must be between 0 and 50 percent.",
                            }),
                        noShowFee: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 100), {
                                message: "No show fee must be between 0 and 100 percent.",
                            }),
                        paymentDeadline: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 2 && val <= 24), {
                                message: "Payment deadline must be between 2 and 24 hours.",
                            }),
                        advanceBooking: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 1 && val <= 23), {
                                message: "Advance booking hours must be between 1 and 23 hours.",
                            }),
                        peakHourSurcharge: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Peak hour surcharge must be between 0 and 50 percent.",
                            }),
                        offPeakDiscount: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 50), {
                                message: "Off peak discount must be between 0 and 50 percent.",
                            }),
                    }).superRefine((_, ctx) => {
                        if (advanceBooking >= paymentDeadline) {
                            ctx.addIssue({
                                code: "custom",
                                path: ["paymentDeadline"],
                                message: "Payment must happen before the hours before booking.",
                            });
                        }
                    });
    
                    const parsed = schema.safeParse({
                        minimumHours,
                        maximumHours,
                        cancellationFee,
                        noShowFee,
                        paymentDeadline,
                        advanceBooking,
                        peakHourSurcharge,
                        offPeakDiscount
                    });
    
                    if (!parsed.success) {
                        const errors: Record<string, string> = {};
                        parsed.error.issues.forEach((issue) => {
                            const path = issue.path.join(".");
                            errors[`settings.${path}`] = issue.message;
                        });
    
                        setErrorsWithTimeout(errors);
                        return false;
                    };
    
                    return true;   
                }
        }
    };

    const next = () => {
        const parsed = validateData();

        if (parsed && currentIndex < steps.length - 1) {
            setCurrentIndex((i) => i + 1);
        }
    };

    const previous = () => {
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    };

    const handleSave = () => {
        const parsed = validateData();

        if (!parsed) return;

        const defaultSettings = formData.settings;

        const settings = {
            minBookingHours:
                minimumHours !== defaultSettings.minBookingHours ? minimumHours : null,
            maxBookingHours:
                maximumHours !== defaultSettings.maxBookingHours ? maximumHours : null,
            cancellationFee:
                cancellationFee !== defaultSettings.cancellationFee ? cancellationFee : null,
            noShowFee:
                noShowFee !== defaultSettings.noShowFee ? noShowFee : null,
            paymentDeadline:
                paymentDeadline !== defaultSettings.paymentDeadline ? paymentDeadline : null,
            advanceBooking:
                advanceBooking !== defaultSettings.advanceBooking ? advanceBooking : null,
            peakHourSurcharge:
                peakHourSurcharge !== defaultSettings.peakHourSurcharge ? peakHourSurcharge : null,
            offPeakDiscount:
                offPeakDiscount !== defaultSettings.offPeakDiscount ? offPeakDiscount : null
        };

        const updated = {
            ...combination,
            name,
            description,
            grounds,
            surfaceType: combination.surfaceType,
            size,
            images: [],
            price,
            settings
        };

        setFormData({
            ...formData,
            layout: {
                ...formData.layout,
                combinations: formData.layout.combinations.map((combination: CombinationType) =>
                    combination.id === target ? updated : combination
                )
            }
        });

        setCurrentIndex(0);
        onClose();
    };

    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div
                    className="modal fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    onClick={onClose}
                >
                    <div
                        className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-2 py-3 flex flex-col justify-between gap-y-32 w-60">
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-x-2.5">
                                        <IoGridOutline className="size-4 text-black" />
                                        <span className="font-medium text-[0.825rem]">Edit Combination</span>
                                    </div>
                                </div>
                                <div className="my-6">
                                    <p className="text-[0.8125rem] text-gray-600">
                                        Update grounds, details, or settings of this combination.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-y-1">
                                    {steps.map((step, i) => {
                                        const isActive = i === currentIndex;
                                        const isComplete = i < currentIndex;
                                        return (
                                            <div
                                                key={i}
                                                className="p-2 flex items-center gap-x-2 rounded-md"
                                                style={
                                                    isActive
                                                        ? { background: "#e5e7eb" }
                                                        : isComplete
                                                        ? {}
                                                        : { color: "#6a7282" }
                                                }
                                            >
                                                {step.icon}
                                                <span className="font-medium text-[0.8125rem]">
                                                    {step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-y-2.5">
                                <span className="text-[0.8125rem] text-gray-700">
                                    Step {currentIndex + 1} of {steps.length}
                                </span>
                                <div className="bg-blue-200 w-full relative h-1 rounded-md overflow-clip">
                                    <div
                                        className="absolute h-full bg-blue-700"
                                        style={{
                                            width: `${((currentIndex + 1) / steps.length) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="rounded-md p-5 flex flex-col justify-between bg-white border border-gray-300 w-lg">
                            <div className="flex-1">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-1 flex-col gap-y-0.5">
                                        <h2 className="font-medium text-sm">
                                            {steps[currentIndex].title}
                                        </h2>
                                        <p className="text-[0.8rem] text-gray-600 max-w-3/4">
                                            {steps[currentIndex].description}
                                        </p>
                                    </div>
                                    <button
                                        className="hover:text-gray-600 cursor-pointer"
                                        type="button"
                                        onClick={onClose}
                                    >
                                        <IoIosClose className="size-6" />
                                    </button>
                                </div>
                                <div className="mt-5 mb-6">
                                    {steps[currentIndex].component}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-x-2">
                                {currentIndex !== 0 && (
                                    <button
                                        type="button"
                                        onClick={previous}
                                        className="rounded-md border px-6 py-2 border-gray-300 bg-white text-xs cursor-pointer"
                                    >
                                        Previous
                                    </button>
                                )}
                                {currentIndex !== steps.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={next}
                                        className="rounded-md border px-6 py-2.5 text-white bg-black hover:bg-gray-800 text-xs cursor-pointer"
                                    >
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="rounded-md border px-6 py-2.5 text-white bg-black hover:bg-gray-800 text-xs cursor-pointer"
                                    >
                                        Save Changes
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    );
};
