import { useRef, useState } from "react";
import z from 'zod';

import { PathLink } from "@/app/components/base/PathLink";
import Input from "@/app/components/dashboard/Input";

import { MdGrass, MdOutlineCloudUpload } from "react-icons/md";
import { IoSettingsOutline, IoGridOutline } from "react-icons/io5";
import { FaPeopleGroup } from "react-icons/fa6";
import { IoIosClose, IoIosInformationCircleOutline, IoMdPeople } from "react-icons/io";
import { CgDetailsMore } from "react-icons/cg";
import { MdEmojiPeople } from "react-icons/md";

import { v4 as randomUUID } from "uuid";
import useFormContext from "@/app/context/useFormContext";
import { GroundType } from "../Layout";
import { generateDefaultGroundName } from "@/app/utils/layout";

// Start of groundModal steps
const GroundModalDetails = ({
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
        <div className="flex flex-col gap-y-4 text-[0.8125rem]">
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="Ground Name" 
                        description="Defaults to 'Ground A' normally."
                        error={errors?.["details.name"]}
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Override Price" 
                        value={price} 
                        onChange={(e) => setPrice(e.target.value)} 
                        placeholder="Ground Price" 
                        description="Pitch base price specified previously by default."
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
                    description="Pitch base description specified previously will be used by default. Only use this field for ground-specific information."
                    error={errors?.["details.description"]}
                />
            </div>

            <div className="flex flex-col gap-y-1.5">
                <span>Ground Images</span>
                <div className="flex flex-col gap-y-2 w-full">
                    <div className="p-4 flex items-center gap-x-4 rounded-md border-[1px] border-gray-200 bg-gray-50 border-dashed">
                        <MdOutlineCloudUpload className="size-5 text-gray-700"/>
                        <div className="text-xs">
                            <p className="text-gray-500"><button type="button" className="cursor-pointer text-black underline">Click to upload</button> or drag and drop.</p>
                            <p className="text-gray-500">PNG, JPG, GIF up to 10MB.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const GroundModalSize = ({ size, setSize } : { size: "FIVE" | "SEVEN" | "ELEVEN", setSize: (value: "FIVE" | "SEVEN" | "ELEVEN") => void }) => {
    const sizeMap = new Map<string, number>([
        ["FIVE", 0],
        ["SEVEN", 1],
        ["ELEVEN", 2]
    ]);

    const options = [
        {
            label: "Five-a-side",
            value: "FIVE",
            icon: <MdEmojiPeople className="size-5"/>,
            description: "The smallest ground. Suitable for a capacity of up to 10 players.",
            analysis: "A small-sized ground suitable for five-a-side games. This can also be combined/upscaled to larger sizes. Two adjacent 5-a-side grounds can be combined to form a larger 7-a-side combination. Three adjacent 5-a-side grounds can form an 11-a-side combination."
        },
        {
            label: "Seven-a-side",
            value: "SEVEN",
            icon: <IoMdPeople className="size-5"/>,
            description: "Medium-sized ground. Takes up to 14 players.",
            analysis: "A medium-sized ground suitable for seven-a-side games. This can also be combined/upscaled to larger sizes. An adjacent 7-a-side and 5-a-side ground can be combined to form a larger 11-a-side combination."
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
                            <div key={index} className="w-full text-xs">
                                <PathLink isSelected={index === sizeMap.get(size)} icon={option.icon} title={option.label} description={option.description} className="w-full!" onClick={() => setSize(option.value as "FIVE" | "SEVEN" | "ELEVEN")} />
                            </div>
                        )
                    })
                }
            </div>
            <p className="text-[0.8125rem] my-6 text-gray-600">{options[sizeMap.get(size)!].analysis}</p>
        </>
    )
}

const GroundModalSurfaceType = ({ surfaceType, setSurfaceType } : { surfaceType: "FG" | "AG" | "TF" | "HW", setSurfaceType: (value: "FG" | "AG" | "TF" | "HW") => void }) => {
    const surfaceTypeMap = new Map<string, number>([
        ["FG", 0],
        ["AG", 1],
        ["TF", 2],
        ["HW", 3]
    ]);

    const options = [
        {
            label: "Natural Grass",
            value: "FG",
        },
        {
            label: "Artificial Grass",
            value: "AG",
        },
        {
            label: "Turf Field",
            value: "TF"
        },
        {
            label: "Hard Wood",
            value: "HW",
            description: "Usually a futsal or indoor court."
        },
    ];

    return (
        <div className="flex items-center justify-center h-full">
            <div className="grid grid-cols-2 grid-rows-2 gap-4">
                {
                    options.map((option, index) => {
                        return (
                            <div key={index} className="w-full text-xs">
                                <PathLink isSelected={index === surfaceTypeMap.get(surfaceType)} title={option.label} description={option.description} className="w-full! h-full" onClick={() => setSurfaceType(option.value as "FG" | "AG" | "TF" | "HW")} />
                            </div>
                        )
                    })
                }
            </div>
        </div>
    )
}

const GroundModalSettings = ({ 
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
        <div className="flex flex-col gap-y-4 text-[0.8125rem] mt-4 mb-8">
            <div className="flex gap-x-4">
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Minimum Booking Hours" 
                        value={minimumHours} 
                        description="Override the default pitch minimum booking hours." 
                        onChange={(e) => setMinimumHours(e.target.value)} 
                        placeholder="Minimum Hours" 
                        error={errors?.["settings.minimumHours"]}
                        unit={minimumHours === "1" ? "Hour" : "Hours"}
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
                        unit={maximumHours === "1" ? "Hour" : "Hours"}
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
                        unit={paymentDeadline === "1" ? "Hour" : "Hours"}
                    />
                </div>
                <div className="flex flex-1 flex-col gap-y-1.5">
                    <Input 
                        label="Hours Before Booking" 
                        value={advanceBooking}
                        onChange={(e) => setAdvanceBooking(e.target.value)} 
                        placeholder="Advance Booking" 
                        error={errors?.["settings.advanceBooking"]}
                        unit={advanceBooking === "1" ? "Hour" : "Hours"}
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
}

// Start of addGroundModal component
export const AddGroundModal = ({ isOpen, onClose } : { isOpen: boolean, onClose: () => void }) => {
    const { formData, setFormData } = useFormContext();

    const [currentIndex, setCurrentIndex] = useState(0);

    const [name, setName] = useState("");
    const [price, setPrice] = useState(formData.details.basePrice);
    const [description, setDescription] = useState("");

    const [size, setSize] = useState<"FIVE" | "SEVEN" | "ELEVEN">("FIVE");
    const [surfaceType, setSurfaceType] = useState<"FG" | "AG" | "TF" | "HW">("FG");

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

    const addGroundModalDetailsProps = {
        name,
        price,
        description,
        setName,
        setPrice,
        setDescription
    }

    const addGroundModalSettingsProps = {
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

    if (!isOpen) return null;

    const steps = [
        {
            label: "Details",
            icon: <CgDetailsMore className="size-3.5"/>,
            title: "Ground Details",
            description: "Provide details about the ground.",
            component: <GroundModalDetails {...addGroundModalDetailsProps} errors={errors}/>
        },
        {
            label: "Size",
            icon: <FaPeopleGroup className="size-3.5"/>,
            title: "Select Ground Size",
            description: "Specify the size of the ground.",
            component: <GroundModalSize 
                size={size} 
                setSize={setSize}
            />
        },
        {
            label: "Surface Type",
            icon: <MdGrass className="size-3.5"/>,
            title: "Select Ground Material",
            description: "Specify the material of the ground.",
            component: <GroundModalSurfaceType 
                surfaceType={surfaceType} 
                setSurfaceType={setSurfaceType}
            />
        },
        {
            label: "Settings",
            icon: <IoSettingsOutline className="size-3.5"/>,
            title: "Ground Settings",
            description: "Configure the settings for the ground to override your default pitch settings.",
            component: <GroundModalSettings {...addGroundModalSettingsProps} errors={errors}/>
        }
    ];

    const validateData = () => {
        switch (currentIndex) {
            case 0:
                {
                    const defaultName = generateDefaultGroundName(formData.layout.grounds);

                    const existingNames = formData.layout.grounds.map((ground: GroundType) => ground.name.toLowerCase());

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
                            })
                            .refine(val => !existingNames.includes(val.toLowerCase()), {
                                message: "A ground name with this title already exists.",
                            }),
                        price: z.string("Ground price is required.")
                            .min(2, "This field is required.")
                            .transform(Number)
                            .refine((val) => val >= 50 && val <= 2000, {
                                message: "Ground price must be between 50 and 2000 EGP per hour.",
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
            case 1:
                return true;
            case 2:
                return true;
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
                            .refine((val) => val === null || (val >= 0 && val <= 24), {
                                message: "Payment deadline must be between 0 and 24 hours.",
                            }),
                        advanceBooking: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 23), {
                                message: "Advance booking hours must be between 0 and 23 hours.",
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
        setName("");
        setPrice(formData.details.basePrice);
        setDescription("");

        setSize("FIVE");
        setSurfaceType("FG");

        setMinimumHours(formData.settings.minBookingHours);
        setMaximumHours(formData.settings.maxBookingHours);
        setCancellationFee(formData.settings.cancellationFee);
        setNoShowFee(formData.settings.noShowFee);
        setPaymentDeadline(formData.settings.paymentDeadline);
        setAdvanceBooking(formData.settings.advanceBooking);
        setPeakHourSurcharge(formData.settings.peakHourSurcharge);
        setOffPeakDiscount(formData.settings.offPeakDiscount);
    };

    const handleCreateGround = () => {
        // TODO: Implement a function to clear the state back to default values when the creation is successful.
        const parsed = validateData();
        if (!parsed) return;

        clearData();
        setCurrentIndex(0);

        const id = randomUUID();
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

        const ground = {
            id: id,
            name,
            description,
            surfaceType,
            size,
            images: [],
            price,
            settings
        };

        setFormData({
            ...formData,
            layout: {
                ...formData.layout,
                grounds: [
                    ...formData.layout.grounds,
                    ground
                ]
            }
        });

        onClose();
    };

    return (
        <div className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
            <div className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-3 flex flex-col justify-between gap-y-32 w-56">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-x-2.5">
                                <IoGridOutline className="size-4 text-black"/>
                                <span className="font-medium">Add Ground</span>
                            </div>
                            <div className="relative">
                                <IoIosInformationCircleOutline className="size-4.5 text-gray-500"/>
                            </div>
                        </div>
                        <div className="my-6">
                            <p className="text-[0.8125rem] text-gray-600">Each pitch requires <span className="underline">at least one ground</span> before being submitted for review. Please make sure your layout is as accurate as possible to the real-world environment.</p>
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
                            <div className="flex flex-1 flex-col gap-y-1">
                                <h2 className="font-medium">{steps[currentIndex].title}</h2>
                                <p className="text-[0.8125rem] text-gray-600 max-w-3/4">{steps[currentIndex].description}</p>
                            </div>
                            <button className="hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                                <IoIosClose className="size-6"/>
                            </button>
                        </div>
                        <div className="h-[calc(100%-5.5rem)] my-5">
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
                            <button type="button" onClick={handleCreateGround} className="flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                <span className="text-xs">Create</span>
                            </button>
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

// Start of editGroundModal component
export const EditGroundModal = ({
    isOpen,
    onClose,
    target,
}: {
    isOpen: boolean;
    onClose: () => void;
    target: string;
}) => {
    const { formData, setFormData } = useFormContext();

    const ground = formData.layout.grounds.find((ground: GroundType) => ground.id === target);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [name, setName] = useState(ground.name);
    const [price, setPrice] = useState(ground.price);
    const [description, setDescription] = useState(ground.description ?? "");

    const [size, setSize] = useState(ground.size);
    const [surfaceType, setSurfaceType] = useState(ground.surfaceType);

    const [minimumHours, setMinimumHours] = useState(ground.settings.minBookingHours ?? formData.settings.minBookingHours);
    const [maximumHours, setMaximumHours] = useState(ground.settings.maxBookingHours ?? formData.settings.maxBookingHours);
    const [cancellationFee, setCancellationFee] = useState(ground.settings.cancellationFee ?? formData.settings.cancellationFee);
    const [noShowFee, setNoShowFee] = useState(ground.settings.noShowFee ?? formData.settings.noShowFee);
    const [paymentDeadline, setPaymentDeadline] = useState(ground.settings.paymentDeadline ?? formData.settings.paymentDeadline);
    const [advanceBooking, setAdvanceBooking] = useState(ground.settings.advanceBooking ?? formData.settings.advanceBooking);
    const [peakHourSurcharge, setPeakHourSurcharge] = useState(ground.settings.peakHourSurcharge ?? formData.settings.peakHourSurcharge);
    const [offPeakDiscount, setOffPeakDiscount] = useState(ground.settings.offPeakDiscount ?? formData.settings.offPeakDiscount);

    const groundModalDetailsProps = {
        name,
        price,
        description,
        setName,
        setPrice,
        setDescription
    };

    const groundModalSettingsProps = {
        minimumHours,
        maximumHours,
        cancellationFee,
        noShowFee,
        paymentDeadline,
        advanceBooking,
        peakHourSurcharge,
        offPeakDiscount,
        setMinimumHours,
        setMaximumHours,
        setCancellationFee,
        setNoShowFee,
        setPaymentDeadline,
        setAdvanceBooking,
        setPeakHourSurcharge,
        setOffPeakDiscount,
    };

    const setErrorsWithTimeout = (data: Record<string, string>) => {
        setErrors(data);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setErrors({}), 3000);
    };

    const steps = [
        {
        label: "Details",
        icon: <CgDetailsMore className="size-3.5" />,
        title: "Edit Ground Details",
        description: "Update the name, price or description.",
        component: (
            <GroundModalDetails
                {...groundModalDetailsProps}
                errors={errors}
            />
        ),
        },
        {
            label: "Size",
            icon: <FaPeopleGroup className="size-3.5" />,
            title: "Update Size",
            description: "Adjust the ground size.",
            component: <GroundModalSize size={size} setSize={setSize} />,
        },
        {
            label: "Surface",
            icon: <MdGrass className="size-3.5" />,
            title: "Update Surface Type",
            description: "Change the ground surface material.",
            component: <GroundModalSurfaceType surfaceType={surfaceType} setSurfaceType={setSurfaceType} />,
        },
        {
            label: "Settings",
            icon: <IoSettingsOutline className="size-3.5" />,
            title: "Ground Settings",
            description: "Modify the booking settings for this ground.",
            component: (
                <GroundModalSettings
                    {...groundModalSettingsProps}
                    errors={errors}
                />
            ),
        },
    ];

    const validateData = () => {
        switch (currentIndex) {
            case 0:
                {
                    const defaultName = generateDefaultGroundName(formData.layout.grounds);

                    const existingNames = formData.layout.grounds
                        .filter((ground: GroundType) => ground.id !== target)
                        .map((ground: GroundType) => ground.name.toLowerCase());

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
                            })
                            .refine(val => !existingNames.includes(val.toLowerCase()), {
                                message: "A ground name with this title already exists.",
                            }),
                        price: z.string("Ground price is required.")
                            .min(2, "This field is required.")
                            .transform(Number)
                            .refine((val) => val >= 50 && val <= 2000, {
                                message: "Ground price must be between 50 and 2000 EGP per hour.",
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
            case 1:
                return true;
            case 2:
                return true;
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
                            .refine((val) => val === null || (val >= 0 && val <= 24), {
                                message: "Payment deadline must be between 0 and 24 hours.",
                            }),
                        advanceBooking: z
                            .union([z.string(), z.null()])
                            .transform((val) => (val === null ? null : Number(val)))
                            .refine((val) => val === null || (val >= 0 && val <= 23), {
                                message: "Advance booking hours must be between 0 and 23 hours.",
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
            setCurrentIndex(currentIndex + 1);
        }
    };

    const previous = () => currentIndex > 0 && setCurrentIndex(currentIndex - 1);

    const handleSave = () => {
        const parsed = !validateData();
        if (parsed) return;

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

        const updatedGround = {
            ...ground,
            name,
            description,
            surfaceType,
            size,
            images: [],
            price,
            settings
        };

        setFormData({
            ...formData,
            layout: {
                ...formData.layout,
                grounds: formData.layout.grounds.map((g: GroundType) =>
                    g.id === target ? updatedGround : g
                )
            }
        });

        setCurrentIndex(0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={onClose}>
            <div className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4" onClick={(e) => e.stopPropagation()}>
                <div className="px-2 py-3 flex flex-col justify-between gap-y-32 w-56">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-x-2.5">
                                <IoGridOutline className="size-4 text-black"/>
                                <span className="font-medium">Edit Ground</span>
                            </div>
                            <IoIosInformationCircleOutline className="size-4.5 text-gray-500" />
                        </div>
                        <div className="my-6 text-[0.8125rem] text-gray-600">
                            Update any ground details and save your changes.
                        </div>
                        <div className="flex flex-col gap-y-1">
                        {
                            steps.map((step, index) => {
                                const isActive = index === currentIndex;
                                const isComplete = index < currentIndex;
                                return (
                                    <div
                                        key={index}
                                        className={`p-2 flex items-center gap-x-2 rounded-md ${isActive ? "bg-gray-200" : isComplete ? "" : "text-gray-400"}`}
                                    >
                                        {step.icon}
                                        <span className="font-medium text-[0.8125rem]">{step.label}</span>
                                    </div>
                                );
                            })
                        }
                        </div>
                    </div>
                    <div className="flex flex-col gap-y-2.5">
                        <span className="text-[0.8125rem] text-gray-700">
                            Step {currentIndex + 1} of {steps.length}
                        </span>
                        <div className="bg-blue-200 w-full relative h-1 rounded-md overflow-clip">
                        <div
                            className="absolute h-full bg-blue-700"
                            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
                        />
                        </div>
                    </div>
                </div>
                <div className="rounded-md p-5 flex flex-col justify-between bg-white border-[1px] border-gray-300 w-lg">
                    <div className="flex-1">
                        <div className="flex items-start justify-between">
                            <div className="flex flex-1 flex-col gap-y-1">
                                <h2 className="font-medium">{steps[currentIndex].title}</h2>
                                <p className="text-[0.8125rem] text-gray-600 max-w-3/4">
                                {steps[currentIndex].description}
                                </p>
                            </div>
                            <button className="hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                                <IoIosClose className="size-6" />
                            </button>
                        </div>
                        <div className="h-[calc(100%-5.5rem)] my-5">
                            {steps[currentIndex].component}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-x-2">
                        {
                            currentIndex !== 0 && 
                            <button
                                type="button"
                                onClick={previous}
                                className="rounded-md border px-6 py-2 border-gray-300 bg-white text-xs"
                            >
                                Previous
                            </button>
                        }
                        {
                            currentIndex !== steps.length - 1 ?
                            <button
                                type="button"
                                onClick={next}
                                className="rounded-md border px-6 py-2 text-white bg-black hover:bg-gray-800 text-xs"
                            >
                                Next
                            </button> : 
                            <button
                                type="button"
                                onClick={handleSave}
                                className="rounded-md border px-6 py-2 text-white bg-black hover:bg-gray-800 text-xs"
                            >
                                Save Changes
                            </button>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
    };
