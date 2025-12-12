"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import _ from "lodash";
import z from "zod";

import copyToClipboard from "@/app/utils/copy";
import Input, { Dropdown, MultiDropdown, TextArea } from "@/app/components/dashboard/Input";
import { Invitation } from "@/app/utils/types/invitation";
import { AccessRole, Manager, ManagerPermissions } from "@/app/utils/types/manager";
import { PitchStatus } from "@/app/utils/types/pitch";
import { createInvitation, fetchPitchSettings, updatePitchPermissions, updatePitchSettings, updatePitchState } from "@/app/utils/api/client";

import { BiPlus } from "react-icons/bi";
import { IoIosClose, IoIosInformationCircleOutline } from "react-icons/io";
import { PiBroadcastFill } from "react-icons/pi";
import { FaRegCircleCheck, FaStoreSlash } from "react-icons/fa6";
import { MdDeleteForever } from "react-icons/md";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";

const handleCopyLink = (invitation: Invitation) => {
    if (invitation == null) return;

    const link = `${process.env.NEXT_PUBLIC_URL}/invitation?token=${invitation.token}`;
    copyToClipboard(link);
};

const CreateInvitationModal = ({ isOpen, onClose, id } : { isOpen: boolean, onClose: () => void, id: string }) => {
    const queryClient = useQueryClient();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [expiresIn, setExpiresIn] = useState("1");

    const [invitation, setInvitation] = useState<Invitation | null>(null);

    const [errors, setErrors] = useState<Record<string, string>>();

    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const mutation = useMutation({
        mutationFn: (data: z.infer<typeof schema>) => createInvitation(data),
        onSuccess: (invitation) => {
            setInvitation(invitation.data);
            queryClient.invalidateQueries({ queryKey: ["dashboard", "pitch", id, "settings"] });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (error: any) => {
            alert(error.message);
        }
    });

    const schema = z.object({
        id: z.string(),
        firstName: z
            .string({ error: "Please enter a valid first name." })
            .min(2, { error: "First name must be at least 2 characters." })
            .max(100, { error: "First name must be at most 100 characters." }),
        lastName: z
            .string({ error: "Please enter a valid last name." })
            .min(2, { error: "Last name must be at least 2 characters." })
            .max(100, { error: "Last name must be at most 100 characters." }),
        email: z
            .email({ error: "Please enter a valid email address." }),
        message: z.
            string()
            .max(500, "Additional message may not be longer than 500 characters.")
            .trim()
            .transform((val) => (val === "" ? null : val)),
        expiresIn: z.enum([ "1", "7", "30" ])
    });

    const setErrorsWithTimeout = (errors: Record<string, string>) => {
        setErrors(errors);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setErrors({});
        }, 3000);
    };

    const handleSubmit = async () => {
        const parsed = schema.safeParse({ id, firstName, lastName, email, message, expiresIn });
        
        if (!parsed.success) {
            const errors: Record<string, string> = {};

            parsed.error.issues.forEach((issue) => {
                const path = issue.path.join(".");
                errors[`${path}`] = issue.message;
            });

            setErrorsWithTimeout(errors);

            return;
        };

        // Run the mutation and handle loading and error cases
        mutation.mutate(parsed.data);
    };

    const handleClose = () => {
        if (!invitation) {
            onClose();
            setErrors({});
            return;
        };

        setInvitation(null);
        setFirstName("");
        setLastName("");
        setEmail("");
        setMessage("");
        setExpiresIn("1");
        onClose();
    };
    
    return (
        <AnimatePresence>
            {
                isOpen &&
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={handleClose}>
                    <div className="flex flex-col gap-y-4 gap-x-4 bg-gray-50 rounded-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
                        {
                            invitation ?
                            <div>
                                <div className="flex items-center justify-end">
                                    <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={handleClose}>
                                        <IoIosClose className="size-6"/>
                                    </button>
                                </div>
                                <div className="text-[0.8125rem] w-lg flex flex-col items-center justify-center gap-y-2 text-center text-xs">
                                    <FaRegCircleCheck className="size-8 text-gray-400 mb-3"/>
                                    <h2 className="text-sm font-medium text-center">Your invitation has been created successfully!</h2>
                                    <p className="text-gray-500">An invitation has been created and sent to {invitation.firstName} at the following email address: {invitation.email}. This invitation will be valid until <span className="underline">{format(invitation.expiresAt, "h:mm")}</span> on <span className="underline">{format(invitation.expiresAt, "MMMM do, yyyy")}.</span></p>
                                    <p className="text-gray-500">You may revoke this invitation at any time through your pitch settings.</p>
                                    <div className="mt-4 mb-2">
                                        <button className="text-blue-700 hover:underline cursor-pointer" onClick={() => handleCopyLink(invitation)}>Copy invitation link</button>
                                    </div>
                                </div>
                            </div> :
                            <>
                                <div className="flex items-start justify-between gap-x-4 w-full">
                                    <div className="flex-1 flex flex-col gap-y-0.5 mt-1">
                                        <h2 className="text-sm font-medium">Create Invitation</h2>
                                        <p className="text-[0.8125rem] text-gray-500 max-w-96">Invite managers to add them to your team to help you manage your pitch and track bookings/payments.</p>
                                    </div>
                                    <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={handleClose}>
                                        <IoIosClose className="size-6"/>
                                    </button>
                                </div>
                                <div className="flex text-[0.8125rem] w-lg flex-col gap-y-4 mt-2 mb-1 bg-white border-[1px] border-gray-300 p-4 rounded-md">
                                    <div className="flex gap-x-4">
                                        <Input
                                            label="First Name"
                                            placeholder="First Name"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            error={errors?.["firstName"]}
                                            required
                                        />
                                        <Input
                                            label="Last Name"
                                            placeholder="Last Name"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            error={errors?.["lastName"]}
                                            required
                                        />
                                    </div>
                                    <Input
                                        label="Email"
                                        placeholder="Email Address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        error={errors?.["email"]}
                                        required
                                    />
                                    <TextArea 
                                        label="Message" 
                                        placeholder="Add a message..."
                                        value={message}
                                        error={errors?.["message"]}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                    <Dropdown 
                                        label="Expires In"
                                        options={[
                                            { value: "1", label: "24 hours" },
                                            { value: "7", label: "7 days" },
                                            { value: "30", label: "30 days" },
                                        ]}
                                        value={expiresIn}
                                        onChange={(e) => setExpiresIn(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex items-center justify-end">
                                    <button type="button" onClick={handleSubmit} className="flex items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2.5 text-white bg-black hover:bg-gray-800 transition-colors w-28 cursor-pointer">
                                        <span className="text-xs">Create</span>
                                    </button>
                                </div> 
                            </>   
                        }
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
};

const PermissionsModal = ({ data, onClose, id } : { data: ManagerTableItem | null, onClose: () => void, id: string }) => {
    const queryClient = useQueryClient();
    
    const options = [
        { value: "UNAUTHORIZED", label: "Not Allowed" },
        { value: "VIEW", label: "View" },
        { value: "WRITE", label: "Write" },
    ];

    // We can be sure that data is not undefined here because we are wrapping PermissionsModal in a conditional rendering statement
    const permissions = data!.permissions;
    const manager = data!.manager;

    const [temp, setTemp] = useState<Omit<ManagerPermissions, "pitchId" | "managerId">>(permissions);
    
    const handleClose = () => {
        onClose();
    };
    
    const mutation = useMutation({
        mutationFn: ({ manager, data } : { manager: string, data: Omit<ManagerPermissions, "pitchId" | "managerId"> }) => updatePitchPermissions(manager, data, id),
        mutationKey: ["pitch", id, "settings"],
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["dashboard", "pitch", id, "settings"] });
            onClose();
        }
    });

    const initial = permissions;
    const addedAt = `${format(manager.acceptedAt, "MMMM do, yyyy")} at ${format(manager.acceptedAt, "h:mm a")}`;
    const isDirty = !_.isEqual(temp, initial);
    
    return (
        <AnimatePresence>
            {
                data && 
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={handleClose}>
                    <div className="flex gap-x-4 bg-gray-50 rounded-md p-4 m-4" onClick={(e) => e.stopPropagation()}>
                        <div className="px-2 py-3 flex flex-col justify-between gap-y-32 w-56">
                            <div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-x-2.5">
                                        <span className="font-medium text-sm">Manager Details</span>
                                    </div>
                                    <div className="relative">
                                        <IoIosInformationCircleOutline className="size-4.5 text-gray-500"/>
                                    </div>
                                </div>
                                <div className="my-6 flex flex-col gap-y-4 text-[0.8rem]">
                                    <div className="w-full">
                                        <div className="flex flex-col gap-y-1 flex-1">
                                            <span>ID</span>
                                            <span className="text-gray-500">{data.manager.id}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-x-2">
                                        <div className="flex flex-col gap-y-1 flex-1">
                                            <span>First Name</span>
                                            <span className="text-gray-500">{data.manager.user.firstName}</span>
                                        </div>
                                        <div className="flex flex-col gap-y-1 flex-1">
                                            <span>Last Name</span>
                                            <span className="text-gray-500">{data.manager.user.lastName}</span>
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <div className="flex flex-col gap-y-1 flex-1">
                                            <span>Email Address</span>
                                            <span className="text-gray-500">{data.manager.user.email}</span>
                                        </div>
                                    </div>
                                    <div className="w-full">
                                        <div className="flex flex-col gap-y-1 flex-1">
                                            <span>Added At</span>
                                            <span className="text-gray-500">{addedAt}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-md p-5 flex flex-col justify-between bg-white border-[1px] border-gray-300 w-lg">
                            <div className="flex-1">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-1 flex-col gap-y-0.5">
                                        <h2 className="font-medium text-sm">
                                            View/Edit Permissions
                                        </h2>
                                        <p className="text-[0.8rem] text-gray-600 pr-2">
                                            Modify permissions to give certain managers read, write, and access privileges across different platforms.
                                        </p>
                                    </div>
                                    <button className="hover:text-gray-600 cursor-pointer" type="button" onClick={onClose}>
                                        <IoIosClose className="size-6"/>
                                    </button>
                                </div>
                                <div className="h-[calc(100%-5.5rem)] w-full flex flex-col gap-y-4 my-8">
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Bookings</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.bookings}
                                            onChange={(e) => setTemp({ ...temp, bookings: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Settings</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.settings}
                                            onChange={(e) => setTemp({ ...temp, settings: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Payments</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.payments}
                                            onChange={(e) => setTemp({ ...temp, payments: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Analytics</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.analytics}
                                            onChange={(e) => setTemp({ ...temp, analytics: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Schedule</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.schedule}
                                            onChange={(e) => setTemp({ ...temp, schedule: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-x-16 text-[0.8125rem]">
                                        <span className="text-nowrap">Schedule Exceptions</span>
                                        <Dropdown 
                                            options={options} 
                                            value={temp.scheduleExceptions}
                                            onChange={(e) => setTemp({ ...temp, scheduleExceptions: e.target.value as AccessRole })}
                                            wrapperStyle={{fontSize: "0.785rem"}}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-x-2">
                                <button 
                                    type="button" 
                                    onClick={() => mutation.mutate({ manager: data.manager.userId, data: temp })} 
                                    className={`
                                        flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2.5 text-white 
                                        ${isDirty ? 'bg-black hover:bg-gray-800 cursor-pointer' : 'bg-gray-700 cursor-not-allowed'} 
                                        transition-colors
                                    `}
                                >
                                    <span className="text-xs">Save</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            }
        </AnimatePresence>
    )
};

const InvitationsTable = ({ data } : { data: Invitation[] }) => {
    const columnHelper = createColumnHelper<Invitation>();
    const columns = [
        columnHelper.accessor("status", {
            header: "Status",
            cell: info => {
                const value = info.getValue();
                const label = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

                return <span className="text-[0.8rem]">{label}</span>;
            },
        }),
        columnHelper.accessor("email", {
            header: "Email",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("firstName", {
            header: "First Name",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("lastName", {
            header: "Last Name",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("createdAt", {
            header: "Sent On",
            cell: info => {
                const label = format(info.getValue(), "dd/MM/yyyy h:mm a");
                return <span className="text-[0.8rem]">{label}</span>
            },
        }),
        columnHelper.accessor("expiresAt", {
            header: "Expires On",
            cell: info => {
                const label = format(info.getValue(), "dd/MM/yyyy h:mm a");
                return <span className="text-[0.8rem]">{label}</span>
            },
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div>
            {
                table.getHeaderGroups().map(headerGroup => {
                    return (
                        <div className="flex w-full border-[1px] border-gray-200 rounded-t-sm bg-gray-50" key={headerGroup.id}>
                            {
                                headerGroup.headers.map(header => {
                                    return (
                                        <div key={header.id} className="flex-1 p-2">
                                            <h6 className="text-center text-[0.8rem]">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </h6>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                })
            }
            {
                table.getRowModel().rows.length > 0 ?
                table.getRowModel().rows.map(row => {
                    return (
                        <Link 
                            href={`/invitation?token=${row.original.token}`}
                            target="_blank"
                            key={row.id}
                            className="flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            {
                                row.getVisibleCells().map(cell => {
                                    return (
                                        <div key={cell.id} className="flex-1 flex items-center justify-center p-2">
                                            <span className="text-center">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </span>
                                        </div>
                                    )
                                })
                            }
                        </Link>
                    )
                }) :
                <div className="flex flex-col gap-y-3 items-center justify-center px-4 py-8 border-b-[1px] border-x-[1px] border-gray-200 rounded-b-sm">
                    <div className="flex flex-col gap-y-0.5 items-center">
                        <h2 className="text-sm font-medium">You do not have any current invitations.</h2>
                        <p className="text-xs text-gray-600">Create an invitation to add pitch managers to help you manage your pitch.</p>
                    </div>
                </div>
            }
        </div>
    )
};

interface ManagerTableItem {
    manager: Manager,
    permissions: ManagerPermissions
}

const ManagersTable = ({ data, openModal } : { data: ManagerTableItem[], openModal: (permissions: ManagerTableItem) => void }) => {
    const columnHelper = createColumnHelper<ManagerTableItem>();
    const columns = [
        columnHelper.accessor("manager.user.firstName", {
            header: "First Name",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("manager.user.lastName", {
            header: "Last Name",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("manager.user.email", {
            header: "Email",
            cell: info => <span className="text-[0.8rem]">{info.getValue()}</span>,
        }),
        columnHelper.accessor("manager.acceptedAt", {
            header: "Added On",
            cell: info => {
                const label = format(info.getValue(), "MMMM do, yyyy h:mm a");
                return <span className="text-[0.8rem]">{label}</span>
            },
        }),
        columnHelper.accessor("permissions", {
            header: "Permissions",
            cell: info => <button onClick={() => openModal(info.row.original)} className="text-blue-700 hover:underline cursor-pointer text-[0.8rem]" type="button">View Permissions</button>
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div>
            {
                table.getHeaderGroups().map(headerGroup => {
                    return (
                        <div className="flex w-full border-[1px] border-gray-200 rounded-t-sm bg-gray-50" key={headerGroup.id}>
                            {
                                headerGroup.headers.map(header => {
                                    return (
                                        <div key={header.id} className="flex-1 p-2">
                                            <h6 className="text-center text-[0.8rem]">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </h6>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                })
            }
            {
                table.getRowModel().rows.length > 0 ?
                table.getRowModel().rows.map(row => {
                    return (
                        <div key={row.id} className="flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors">
                            {
                                row.getVisibleCells().map(cell => {
                                    return (
                                        <div key={cell.id} className="flex-1 flex items-center justify-center p-2">
                                            <span className="text-center">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </span>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    )
                }) :
                <div className="flex flex-col gap-y-3 items-center justify-center px-4 py-8 border-b-[1px] border-x-[1px] border-gray-200 rounded-b-sm">
                    <div className="flex flex-col gap-y-0.5 items-center">
                        <h2 className="text-sm font-medium">You do not have any managers currently.</h2>
                        <p className="text-xs text-gray-600">Create an invitation to add pitch managers to help you manage your pitch.</p>
                    </div>
                </div>
            }
        </div>
    )
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseData = (data: any) => {
    return {
        id: data.id,
        automaticBookings: data.automaticBookings ? "Yes" : "No",
        paymentDeadline: String(data.paymentDeadline),
        allowDeposit: data.depositFee ? "Yes" : "No",
        depositFee: data.depositFee ? String(data.depositFee) : "",
        minBookingHours: String(data.minBookingHours),
        maxBookingHours: String(data.maxBookingHours),
        cancellationGrace: String(data.cancellationGrace),
        cancellationFee: String(data.cancellationFee),
        noShowFee: String(data.noShowFee),
        advanceBooking: String(data.advanceBooking),
        peakHourSurcharge: String(data.peakHourSurcharge),
        offPeakDiscount: String(data.offPeakDiscount),
        payoutRate: data.payoutRate,
        payoutMethod: data.payoutMethod,
        paymentMethods: data.paymentMethods,
        pitchId: data.pitchId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
};

const PitchStatusConfirmationModal = ({ state, onClose, id } : { state: PitchStatus | null, onClose: () => void, id: string }) => {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [confirmation, setConfirmation] = useState("");

    const handleClose = () => {
        setConfirmation("");
        onClose();
    };

    const mutation = useMutation({ 
        mutationFn: ({ state, id } : { state: PitchStatus, id: string }) => updatePitchState(state, id),
        mutationKey: ["pitch", id, "settings"],
        onSuccess: () => {;
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            
            if (state === "DELETED") {
                router.push("/dashboard/pitches");
                return;
            };

            handleClose();
        }
    });

    if (!state) return null;

    const data = [
        {
            key: "LIVE",
            icon: <PiBroadcastFill className="size-8 text-gray-400 mb-2"/>,
            title: "Publish Pitch",
            subtitle: "Make your pitch publicly visible and ready to receive bookings.",
            description: "Publishing makes your pitch live to customers so they can view details and book instantly. You can still update availability and pricing anytime.",
            action: "Publish",
            requiresConfirmation: false
        },
        {
            key: "ARCHIVED",
            icon: <FaStoreSlash className="size-8 text-gray-400 mb-2"/>,
            title: "Deactivate/Archive Pitch",
            subtitle: "Temporarily hide your pitch without deleting it or losing any data.",
            description: "Archiving removes the pitch from listings but keeps all bookings and records intact. You can reactivate it later whenever you’re ready.",
            action: "Deactivate",
            requiresConfirmation: true
        },
        {
            key: "DELETED",
            icon: <MdDeleteForever className="size-8 text-gray-400 mb-2"/>,
            title: "Delete Pitch",
            subtitle: "Permanently remove this pitch and all related records from the system.",
            description: "Deleting is irreversible and removes all bookings, schedules, and records linked to this pitch. Use only if you’re sure it’s no longer needed.",
            action: "Delete",
            requiresConfirmation: true
        },
    ];

    const activeState = data.find(item => item.key === state);
    if (!activeState) return null;

    const isDisabled = activeState.requiresConfirmation && activeState.key != confirmation;
    
    return (
        <AnimatePresence>
            {
                activeState &&
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed top-0 left-0 flex items-center justify-center w-screen h-screen z-99 bg-black/50" onClick={handleClose}>
                    <div className="bg-gray-50 p-6 rounded-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                            <button className="flex-shrink-0 hover:text-gray-600 cursor-pointer" type="button" onClick={handleClose}>
                                <IoIosClose className="size-6"/>
                            </button>
                        </div>
                        <div className="text-[0.8125rem] w-lg flex flex-col items-center justify-center gap-y-2 text-center text-xs">
                            {activeState.icon}
                            <h2 className="text-sm font-medium text-center">{activeState.title}</h2>
                            <p className="text-gray-500">{activeState.subtitle}</p>
                            <p className="text-gray-500">{activeState.description}</p>
                            {
                                activeState.requiresConfirmation &&
                                <div className="flex flex-col gap-y-2 mt-4 text-xs w-full px-8">
                                    <Input 
                                        value={confirmation}
                                        onChange={(e) => setConfirmation(e.target.value)}
                                        placeholder="Confirm text"
                                        description={`Please enter "${state}" to confirm your changes.`}
                                        className="w-full"
                                    />
                                </div>
                            }
                            <div className="mt-4 mb-2">
                                <button 
                                    type="button" 
                                    className={`
                                        flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2.5 text-white 
                                        ${!isDisabled ? "bg-black hover:bg-gray-800 cursor-pointer" : "bg-gray-800 cursor-not-allowed"}
                                        transition-colors
                                    `}
                                    onClick={() => mutation.mutate({ state, id })}
                                    disabled={isDisabled}
                                >
                                    <span className="text-xs">{activeState.action}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>   
            }
        </AnimatePresence>
    )
};

export default function Client({ id } : { id: string }) {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryKey: ["dashboard", "pitch", id, "settings"],
        queryFn: () => fetchPitchSettings(id),
        initialData: () => queryClient.getQueryData(["dashboard", "pitch", id, "settings"])
    });

    const { settings, invitations, managers, status } = data;

    const managersData = managers.map((item: ManagerTableItem) => ({
        manager: item.manager,
        permissions: { ...item.permissions, managerId: item.manager.id }
    }));

    let initial = parseData(settings);

    const [isCreateInvitationModalOpen, setIsCreateInvitationModalOpen] = useState(false);
    const [statusConfirmationModalState, setStatusConfirmationModalState] = useState<PitchStatus | null>(null);
    const [permissionsModalData, setPermissionsModalData] = useState<ManagerTableItem | null>(null);

    const [temp, setTemp] = useState(initial);
    const isDirty = !_.isEqual(initial, temp);

    const mutation = useMutation({
        mutationFn: ({ id, settings } : { id: string; settings: typeof temp }) => updatePitchSettings(id, settings),
        mutationKey: ["pitch", id, "settings"],
        onSuccess: ({ data }) => {
            // Handle success by setting the current state to the server state
            initial = parseData(data);
            setTemp(initial);

            // Invalidate the query to refetch the updated data if needed
            queryClient.invalidateQueries({ queryKey: ["dashboard", "pitch", id, "settings"] });
        }
    });

    const handleSubmit = () => {
        if (isDirty) {
            mutation.mutate({ id, settings: temp })
        };
    };
    
    return (
        <>
            {
                permissionsModalData &&
                <PermissionsModal
                    data={permissionsModalData}
                    onClose={() => setPermissionsModalData(null)}
                    id={id}
                />
            }
            <CreateInvitationModal 
                isOpen={isCreateInvitationModalOpen}
                onClose={() => setIsCreateInvitationModalOpen(false)}
                id={id}
            />
            <PitchStatusConfirmationModal
                state={statusConfirmationModalState}
                onClose={() => setStatusConfirmationModalState(null)}
                id={id}
            />
            <div className="mx-6 my-4 flex flex-col gap-y-12 [&>div]:last:pb-6">
                <div className="flex flex-col gap-y-6 mt-2">
                    <div className="flex items-center gap-x-16">
                        <h2 className="font-medium">Pitch Settings</h2>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Pitch Status</h3>
                            <p className="text-[0.8rem] text-gray-500">Customize when a pitch becomes publicly bookable & automatically deactivate or archive unavailable pitches.</p>
                        </div>
                        <div className="w-2/3">
                            <AnimatePresence>
                                {
                                    status != "LIVE" &&
                                    <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="flex items-center justify-between gap-x-32 py-5 border-b-[1px] border-gray-200 w-full">
                                        <div className="flex flex-col gap-y-0.5 text-[0.8125rem]">
                                            <span>Go Live</span>
                                            <p className="text-gray-500">Make your pitch live to index, search, and book for all users.</p>
                                        </div>
                                        <div>
                                            <button 
                                                type="button" 
                                                className={`
                                                    flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2.5 text-white
                                                    bg-black hover:bg-gray-800 cursor-pointer
                                                    transition-colors
                                                `}
                                                onClick={() => setStatusConfirmationModalState("LIVE")}
                                            >
                                                <span className="text-xs">Publish</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                }
                            </AnimatePresence>
                            <AnimatePresence>
                                {
                                    (!["ARCHIVED", "APPROVED"].includes(status)) &&
                                    <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="flex items-center justify-between gap-x-32 py-5 border-b-[1px] border-gray-200">
                                        <div className="flex flex-col gap-y-0.5 text-[0.8125rem]">
                                            <span>Deactivate/Archive Pitch</span>
                                            <p className="text-gray-500">Make your pitch unavailable to book while keeping your data accessible/stored on the dashboard.</p>
                                        </div>
                                        <div>
                                            <button 
                                                type="button" 
                                                disabled={status === "ARCHIVED"}
                                                className={`
                                                    flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2.5 text-white 
                                                    bg-black hover:bg-gray-800 cursor-pointer
                                                    transition-colors
                                                `}
                                                onClick={() => setStatusConfirmationModalState("ARCHIVED")}
                                            >
                                                <span className="text-xs">Deactivate</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                }
                            </AnimatePresence>
                            <div className="flex items-center justify-between gap-x-32 py-5">
                                <div className="flex flex-col gap-y-0.5 text-[0.8125rem]">
                                    <span>Delete Pitch</span>
                                    <p className="text-gray-500">Delete your pitch and all of its associated data including bookings, analytics, and payments.</p>
                                </div>
                                <div>
                                    <button 
                                        type="button" 
                                        className={`
                                            flex items-center justify-center gap-x-1 rounded-md border-[1px] px-6 py-2.5 bg-red-700 
                                            text-white hover:bg-red-700/90 cursor-pointer
                                            transition-colors text-nowrap
                                        `}
                                        onClick={() => setStatusConfirmationModalState("DELETED")}
                                    >
                                        <span className="text-xs">Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-y-6">
                    <div className="flex items-center justify-between gap-x-16">
                        <h2 className="font-medium">Booking Settings</h2>
                        <button className="text-blue-700 hover:underline cursor-pointer" type="button">
                            <span className="text-[0.8125rem]">Reset to default</span>
                        </button>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Booking Rules</h3>
                            <p className="text-[0.8rem] text-gray-500">Overall settings that define rules for how long a booking should last and whether to automatically approve them or not.</p>
                        </div>
                        <div className="w-2/3">
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Automatic Booking?</span>
                                <div className="w-20">
                                    <Dropdown 
                                        options={[
                                            { value: "Yes", label: "Yes" },
                                            { value: "No", label: "No" },
                                        ]}
                                        value={temp.automaticBookings}
                                        onChange={(e) => setTemp({ ...temp, automaticBookings: e.target.value })}
                                        wrapperStyle={{fontSize: "0.75rem"}}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Advance Booking</span>
                                <div className="w-24">
                                    <Input
                                        value={temp.advanceBooking}
                                        onChange={(e) => setTemp({ ...temp, advanceBooking: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit={temp.advanceBooking === "1" ? "Hour" : "Hours"}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Minimum Booking Hours</span>
                                <div className="w-24">
                                    <Input
                                        value={temp.minBookingHours}
                                        onChange={(e) => setTemp({ ...temp, minBookingHours: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit={temp.minBookingHours === "1" ? "Hour" : "Hours"}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5">
                                <span className="text-[0.8125rem]">Maximum Booking Hours</span>
                                <div className="w-24">
                                    <Input
                                        value={temp.maxBookingHours}
                                        onChange={(e) => setTemp({ ...temp, maxBookingHours: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit={temp.maxBookingHours === "1" ? "Hour" : "Hours"}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Cancellation Rules</h3>
                            <p className="text-[0.8rem] text-gray-500">Cancellation settings that define rules for how a cancellation on the user&apos;s part should be treated.</p>
                        </div>
                        <div className="w-2/3">
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Cancellation Grace Period</span>
                                <div className="w-24">
                                    <Input
                                        value={temp.cancellationGrace}
                                        onChange={(e) => setTemp({ ...temp, cancellationGrace: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit={temp.cancellationGrace === "1" ? "Hour" : "Hours"}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Cancellation Fee Percentage</span>
                                <div className="w-20">
                                    <Input
                                        value={temp.cancellationFee}
                                        onChange={(e) => setTemp({ ...temp, cancellationFee: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit="%"
                                    />
                                </div>  
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5">
                                <span className="text-[0.8125rem]">No Show Fee Percentage</span>
                                <div className="w-20">
                                    <Input
                                        value={temp.noShowFee}
                                        onChange={(e) => setTemp({ ...temp, noShowFee: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit="%"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-y-6">
                    <div className="flex items-center justify-between gap-x-16">
                        <h2 className="font-medium">Pricing</h2>
                        <button className="text-blue-700 hover:underline cursor-pointer" type="button">
                            <span className="text-[0.8125rem]">Reset to default</span>
                        </button>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Pricing Rules</h3>
                            <p className="text-[0.8rem] text-gray-500">Settings that define how booking prices fluctuate during peak and off-peak hours.</p>
                        </div>
                        <div className="w-2/3">
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Allow Deposit?</span>
                                <div className="w-20">
                                    <Dropdown 
                                        options={[
                                            { value: "Yes", label: "Yes" },
                                            { value: "No", label: "No" },
                                        ]}
                                        value={temp.allowDeposit}
                                        onChange={(e) => setTemp({ ...temp, allowDeposit: e.target.value })}
                                        wrapperStyle={{fontSize: "0.75rem"}}
                                    />
                                </div>
                            </div>
                            {
                                temp.allowDeposit == "Yes" && 
                                <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                    <span className="text-[0.8125rem]">Deposit Fee</span>
                                    <div className="w-20">
                                        <Input
                                            value={temp.depositFee}
                                            onChange={(e) => setTemp({ ...temp, depositFee: e.target.value })}
                                            className="text-[0.75rem]"
                                            unit="%"
                                        />
                                    </div>
                                </div>
                            }
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Payment Deadline</span>
                                <div className="w-24">
                                    <Input
                                        value={temp.paymentDeadline}
                                        onChange={(e) => setTemp({ ...temp, paymentDeadline: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit={temp.paymentDeadline === "1" ? "Hour" : "Hours"}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Peak Hour Surcharge</span>
                                <div className="w-20">
                                    <Input
                                        value={temp.peakHourSurcharge}
                                        onChange={(e) => setTemp({ ...temp, peakHourSurcharge: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit="%"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Off-Peak Discount</span>
                                <div className="w-20">
                                    <Input
                                        value={temp.offPeakDiscount}
                                        onChange={(e) => setTemp({ ...temp, offPeakDiscount: e.target.value })}
                                        className="text-[0.75rem]"
                                        unit="%"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-5">
                                <div className="flex flex-col text-[0.8125rem]">
                                    <span>Payment Methods</span>
                                    <p className="text-gray-500">Allowed payment methods open to the user to select from when booking your pitch.</p>
                                </div>
                                <div className="w-52">
                                    <MultiDropdown 
                                        options={[
                                            { value: "CASH", label: "Cash" },
                                            { value: "CREDIT_CARD", label: "Credit Card" },
                                            { value: "WALLET", label: "Wallet" },
                                        ]}
                                        values={temp.paymentMethods}
                                        onChange={(methods) => setTemp({ ...temp, paymentMethods: methods })}
                                        wrapperStyle={{fontSize: "0.75rem"}}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                        <div className="w-1/3">
                            <h3 className="font-medium mb-1">Payout Rules</h3>
                            <p className="text-[0.8rem] text-gray-500">Choose the payment schedule and method to recieve your pitch&apos;s earnings.</p>
                        </div>
                        <div className="w-2/3">
                            <div className="flex items-center justify-between gap-x-16 py-2.5 border-b-[1px] border-gray-200">
                                <span className="text-[0.8125rem]">Payout Rate</span>
                                <div className="w-40">
                                    <Dropdown 
                                        options={[
                                            { value: "MONTHLY", label: "Monthly" },
                                            { value: "BIWEEKLY", label: "Biweekly" },
                                        ]}
                                        value={temp.payoutRate}
                                        onChange={(e) => setTemp({ ...temp, payoutRate: e.target.value })}
                                        wrapperStyle={{fontSize: "0.75rem"}}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-x-16 py-2.5">
                                <span className="text-[0.8125rem]">Payout Method</span>
                                <div className="w-40">
                                    <Dropdown 
                                        options={[
                                            { value: "CASH", label: "Cash" },
                                            { value: "CREDIT_CARD", label: "Credit Card" },
                                            { value: "WALLET", label: "Wallet" },
                                        ]}
                                        value={temp.payoutMethod}
                                        onChange={(e) => setTemp({ ...temp, payoutMethod: e.target.value })}
                                        wrapperStyle={{fontSize: "0.75rem"}}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end">
                    <button 
                        type="button" 
                        disabled={!isDirty} 
                        onClick={handleSubmit}
                        className={`
                            flex items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2.5 text-white 
                            ${isDirty ? 'bg-black hover:bg-gray-800 cursor-pointer' : 'bg-gray-700 cursor-not-allowed'} 
                            transition-colors w-32
                        `}    
                    >
                        <span className="text-xs">Save Changes</span>
                    </button>
                </div>
                <div className="flex flex-col gap-y-6">
                    <div className="flex items-center justify-between gap-x-16">
                        <h2 className="font-medium">Team & Invitations</h2>
                    </div>
                    <div className="flex flex-col gap-y-4">
                        <div className="flex items-center justify-between gap-x-16">
                            <div>
                                <h2 className="font-medium mb-0.5">Invitations</h2>
                                <p className="text-[0.8rem] text-gray-500">Track, create, or delete invitations to manage your pitch.</p>
                            </div>
                            <button className="flex items-center gap-x-1 text-blue-700 hover:underline cursor-pointer" type="button" onClick={() => setIsCreateInvitationModalOpen(true)}>
                                <BiPlus className="size-4"/>
                                <span className="text-[0.8125rem]">Add Invitation</span>
                            </button>
                        </div>
                        <InvitationsTable 
                            data={invitations}
                        />
                    </div>
                    <div className="flex flex-col gap-y-4">
                        <div className="flex items-center justify-between gap-x-16">
                            <div>
                                <h2 className="font-medium mb-0.5">Managers</h2>
                                <p className="text-[0.8rem] text-gray-500">Track, edit, or remove managers to maintain your pitch.</p>
                            </div>
                        </div>
                        <ManagersTable data={managersData} openModal={setPermissionsModalData} />
                    </div>
                </div>
            </div>
        </>
    )
}
