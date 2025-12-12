import { useEffect, useRef, useState } from "react";
import useFormContext from "@/app/context/useFormContext";

import {
  useReactTable,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
} from "@tanstack/react-table";

import { BiPlus } from "react-icons/bi";
import { sizeMap, surfaceTypeMap } from "@/app/utils/types/maps";
import { LuGitPullRequestCreateArrow, LuGrid2X2 } from "react-icons/lu";

import { AddGroundModal, EditGroundModal } from "@/app/dashboard/pitches/create/steps/modals/Ground";
import { AddCombinationModal, EditCombinationModal } from "@/app/dashboard/pitches/create/steps/modals/Combination";
import { currencyFormat } from "@/app/utils/currency";

export interface GroundType {
    id: string,
    name: string,
    description: string,
    images: string,
    price: number,
    surfaceType: "FG" | "AG" | "TF" | "HW",
    size: "FIVE" | "SEVEN" | "ELEVEN"
}

export interface CombinationType {
    id: string,
    name: string,
    description: string,
    grounds: string[],
    price: number,
    size: "FIVE" | "SEVEN" | "NINE" | "ELEVEN",
    surfaceType: "FG" | "AG" | "TF" | "HW",
    settings: {
        minBookingHours: number,
        maxBookingHours: number,
        cancellationFee: number,
        noShowFee: number,
        advanceBooking: number,
        peakHourSurcharge: number,
        offPeakDiscount: number
    }
}

export function LayoutSidebar({ 
    activeGroundId, 
    activeCombinationId,
    setIsAddGroundModalOpen, 
    setIsAddCombinationModalOpen,
    setIsEditGroundModalOpen,
    setIsEditCombinationModalOpen
} : { 
    activeGroundId: string | null, 
    activeCombinationId: string | null,
    setIsAddGroundModalOpen: (isOpen: boolean) => void,
    setIsAddCombinationModalOpen: (isOpen: boolean) => void,
    setIsEditGroundModalOpen: (isOpen: boolean) => void,
    setIsEditCombinationModalOpen: (isOpen: boolean) => void
}) {
    const { previous, formData } = useFormContext();

    const handlePrevious = () => {
        previous();
        window.scrollTo(0, 0);
    };

    const activeGround = formData.layout.grounds.find((ground: GroundType) => ground.id === activeGroundId);
    const activeCombination = formData.layout.combinations.find((combination: CombinationType) => combination.id === activeCombinationId);

    const hasGrounds = formData.layout.grounds.length > 0;
    const hasCombinations = formData.layout.combinations.length > 0;
    const canCombine = formData.layout.grounds.length > 1;

    return (
        <>
            <div className="fixed bottom-0 right-0 h-[calc(100%-4rem)] w-80 bg-gray-50 border-gray-200 border-l-[1px]">
                <div className="p-4 flex flex-col justify-between w-full h-full">
                    <div className="flex flex-col gap-y-4 text-[0.775rem]">
                        <div className="flex flex-col gap-y-4 rounded-md bg-white p-4 border-[1px] border-gray-200">
                            <div className="flex items-center">
                                <h3 className="text-[0.9rem] font-semibold">Grounds</h3>
                            </div>
                            {
                                activeGround ?
                                <div>
                                    <div className="flex flex-col gap-y-0.5">
                                        <h2 className="text-sm font-medium">{activeGround.name}</h2>
                                        <p className="text-xs text-gray-600">{activeGround.description || "No additional description provided."}</p>
                                    </div>
                                    <div className="flex flex-col gap-y-2 my-4">
                                        <span>Details</span>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Size</span>
                                                <span>{sizeMap.get(activeGround.size)}</span>
                                            </div>
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Surface Type</span>
                                                <span>{surfaceTypeMap.get(activeGround.surfaceType)}</span>
                                            </div>
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Price</span>
                                                <span>{currencyFormat.format(activeGround.price)}</span>
                                            </div>
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Images</span>
                                                {
                                                    activeGround.images.length > 0 ?
                                                    <button type="button" className="text-xs text-blue-700 hover:underline">{activeGround.images.split(",").length} image(s)</button> :
                                                    <span>No images</span>
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div> :
                                <div>
                                    {
                                        hasGrounds ?
                                        <ul className="list-decimal px-4">
                                            {
                                                formData.layout.grounds.map((ground: GroundType, index: number) => {
                                                    return <li key={index} className="mb-1 last:mb-0">{ground.name}</li>
                                                })
                                            }
                                        </ul> :
                                        <div>
                                            <p className="text-gray-600">
                                                Grounds are the smallest unit of your pitch. <br/>
                                                Each ground represents an individual playable area within a pitch. <br/>
                                                You can edit, duplicate, or delete grounds as needed. <br/>
                                            </p>
                                            <div className="mt-6 mb-3">
                                                <span>Details:</span>
                                                <ul className="list-disc ml-5 mt-2 text-gray-700">
                                                    <li>Each ground has its own size, surface type, and lighting.</li>
                                                    <li>You can assign a custom name or number to each ground for easy identification.</li>
                                                    <li>Custom attributes (e.g., equipment, accessibility) can be added per ground.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    }
                                </div>
                            }
                            <div>
                                {
                                    activeGround ?
                                    <button onClick={() => setIsEditGroundModalOpen(true)} type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                        <span className="text-xs">Edit Ground</span>
                                    </button> :
                                    <button onClick={() => setIsAddGroundModalOpen(true)} type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-3 pl-4 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                        <span className="text-xs">Add Ground</span>
                                        <BiPlus className="size-3.5"/>
                                    </button>
                                }
                            </div>
                        </div>
                        <div className="flex flex-col gap-y-4 rounded-md bg-white p-4 border-[1px] border-gray-200">
                            <div className="flex">
                                <h3 className="text-[0.9rem] font-semibold">Combinations</h3>
                            </div>
                            {
                                activeCombination ?
                                <div>
                                    <div className="flex flex-col gap-y-0.5">
                                        <h2 className="text-sm font-medium">{activeCombination.name}</h2>
                                        <p className="text-xs text-gray-600">{activeCombination.description || "No additional description provided."}</p>
                                    </div>
                                    <div className="flex flex-col gap-y-2 my-4">
                                        <span>Details</span>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Size</span>
                                                <span>{sizeMap.get(activeCombination.size)}</span>
                                            </div>
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Surface Type</span>
                                                <span>{surfaceTypeMap.get(activeCombination.surfaceType)}</span>
                                            </div>
                                            <div className="flex flex-col gap-y-1">
                                                <span className="text-gray-500 text-xs">Price</span>
                                                <span>{currencyFormat.format(activeCombination.price)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div> :
                                <div>
                                    {
                                        !hasGrounds &&
                                        <div>
                                            <p className="text-gray-600">
                                                Combinations allow you to group multiple grounds together to create more complex playable areas. <br/>
                                                You can add, edit, or delete combinations as needed. <br/>
                                            </p>
                                        </div>
                                    }
                                    {
                                        hasGrounds && !hasCombinations &&
                                        <p className="text-gray-500">You do not have any combinations currently. You need at least 2 grounds to create a combination.</p>
                                    }
                                    {
                                        hasGrounds && hasCombinations &&
                                        <ul className="list-decimal px-4">
                                            {
                                                formData.layout.combinations.map((combination: CombinationType, index: number) => {
                                                    return <li className="mb-1 last:mb-0" key={index}>{combination.name}</li>
                                                })
                                            }
                                        </ul>
                                    }
                                </div>
                            }
                            <div>
                                {
                                    activeCombination ?
                                    <button onClick={() => setIsEditCombinationModalOpen(true)} type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                                        <span className="text-xs">Edit Combination</span>
                                    </button> :
                                    <button 
                                        type="button" 
                                        disabled={!canCombine} 
                                        onClick={() => setIsAddCombinationModalOpen(true)}
                                        className={`mt-1 flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-3 pl-4 py-2 text-white transition-colors ${canCombine ? "bg-black hover:bg-gray-800 cursor-pointer" : "bg-gray-500 cursor-not-allowed"}`}
                                    >
                                        <span className="text-xs">Add Combination</span>
                                        <BiPlus className="size-3.5"/>
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-x-2">
                        <button type="button" onClick={handlePrevious} className="flex flex-1 items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2 border-gray-300 bg-white transition-colors cursor-pointer">
                            <span className="text-[0.8125rem]">Previous</span>
                        </button>
                        <button type="submit" className="flex flex-1 items-center justify-center gap-x-1 rounded-md border-[1px] px-3 py-2 text-white bg-black hover:bg-gray-800 transition-colors cursor-pointer">
                            <span className="text-[0.8125rem]">Next</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

const GroundsTable = ({ activeGroundId, setActiveGroundId, setIsAddGroundModalOpen } : { activeGroundId: string | null, setActiveGroundId: (ground: string | null) => void, setIsAddGroundModalOpen: (isOpen: boolean) => void }) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const { formData } = useFormContext();
    const data = formData.layout.grounds as GroundType[];

    const columnHelper = createColumnHelper<GroundType>();

    const columns = [
        columnHelper.accessor("name", {
            header: () => <span>Name</span>,
        }),
        columnHelper.accessor("description", {
            header: () => <span>Additional Description</span>,
            cell: info => {
                const label = info.getValue();

                return (
                    <p style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        color: label ? "black" : "oklch(55.1% 0.027 264.364)"
                    }}>{label || "None"}</p>
                )
            }
        }),
        columnHelper.accessor("size", {
            header: () => <span>Size</span>,
            cell: info => sizeMap.get(info.getValue()) ?? info.getValue()
        }),
        columnHelper.accessor("surfaceType", {
            header: () => <span>Surface Type</span>,
            cell: info => surfaceTypeMap.get(info.getValue()) ?? info.getValue()
        }),
        columnHelper.accessor("price", {
            header: () => <span>Price</span>,
            cell: info => <span>{currencyFormat.format(info.getValue())}</span>
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as HTMLElement;

            if (target.closest("button") || target.closest(".modal") || target.closest(".app-table-row")) {
                return;
            }

            if (tableRef.current && !tableRef.current.contains(target)) {
                setActiveGroundId(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setActiveGroundId]);

    return (
        <div ref={tableRef}>
            {
                table.getHeaderGroups().map(headerGroup => {
                    return (
                        <div className="flex w-full border-[1px] border-gray-200 rounded-t-sm bg-gray-50" key={headerGroup.id}>
                            {
                                headerGroup.headers.map(header => {
                                    return (
                                        <div key={header.id} className="flex-1 p-2">
                                            <h6 className="text-center">
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
                        <div key={row.id} className="app-table-row flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors cursor-pointer" style={{ backgroundColor: activeGroundId === row.original.id ? 'rgba(0, 0, 0, 0.05)' : '' }} onClick={() => setActiveGroundId(activeGroundId && activeGroundId === row.original.id ? null : row.original.id)}>
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
                <div className="flex flex-col gap-y-3 items-center justify-center px-4 py-6 border-b-[1px] border-x-[1px] border-gray-200 rounded-b-sm">
                    <div className="flex flex-col gap-y-0.5 items-center">
                        <LuGitPullRequestCreateArrow className="size-6 text-blue-800 mb-1"/>
                        <h2 className="text-sm font-medium">You do not have any grounds yet.</h2>
                        <p className="text-xs text-gray-600">You need at least one ground to start creating bookings with Hagz.</p>
                    </div>
                    <button onClick={() => setIsAddGroundModalOpen(true)} type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                        <span className="text-xs">Add Ground</span>
                    </button>
                </div>
            }
        </div>
    )
};

const CombinationsTable = ({ activeCombinationId, setActiveCombinationId, setIsAddCombinationModalOpen } : { activeCombinationId: string | null, setActiveCombinationId: (combination: string | null) => void, setIsAddCombinationModalOpen: (isOpen: boolean) => void }) => {
    const tableRef = useRef<HTMLDivElement | null>(null);
    const { formData } = useFormContext();
    const data = formData.layout.combinations as CombinationType[];

    const columnHelper = createColumnHelper<CombinationType>();
    
    const columns = [
        columnHelper.accessor("name", {
            header: () => <span>Name</span>,
            cell: info => {
                const name = info.getValue<string>();
                return <span>{name || "-"}</span>;
            },
        }),
        columnHelper.accessor("description", {
            header: () => <span>Additional Description</span>,
            cell: info => {
                const label = info.getValue();

                return (
                    <p style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        color: label ? "black" : "oklch(55.1% 0.027 264.364)"
                    }}>{label || "None"}</p>
                )
            }
        }),
        columnHelper.accessor("size", {
            header: () => <span>Combined Size</span>,
            cell: info => {
                return <span>{sizeMap.get(info.getValue())}</span>;
            },
        }),
        columnHelper.accessor("grounds", {
            header: () => <span>Grounds</span>,
            cell: info => {
                const grounds = info.getValue<string[]>();
                
                if (!Array.isArray(grounds) || grounds.length === 0) {
                    return <span>-</span>;
                };

                return (
                    <div className="flex justify-center gap-x-2 gap-y-1.5 flex-wrap">
                    {
                        formData.layout.grounds.filter((ground: GroundType) => grounds.includes(ground.id)).map((ground: GroundType) => ground.name).map((name: string, i: number) => (
                            <span
                                key={i}
                                className="px-2 py-1 text-xs border-[1px] border-blue-700 text-blue-800 rounded-md"
                            >
                                {name}
                            </span>
                        ))
                    }
                    </div>
                );
            },
        }),
        columnHelper.accessor("price", {
            header: () => <span>Price</span>,
            cell: info => {
                const price = info.getValue<number>();
                return <span>{currencyFormat.format(price)}</span>;
            },
        }),
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const hasGrounds = formData.layout.grounds.length > 1;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as HTMLElement;

            if (target.closest("button") || target.closest(".modal") || target.closest(".app-table-row")) {
                return;
            };

            if (tableRef.current && !tableRef.current.contains(target)) {
                setActiveCombinationId(null);
            };
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setActiveCombinationId]);

    return (
        <div ref={tableRef}>
            {
                table.getHeaderGroups().map(headerGroup => {
                    return (
                        <div className="flex w-full border-[1px] border-gray-200 rounded-t-sm bg-gray-50" key={headerGroup.id}>
                            {
                                headerGroup.headers.map(header => {
                                    return (
                                        <div key={header.id} className="flex-1 p-2">
                                            <span className="text-center w-full block">
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </span>
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
                        <div key={row.id} style={{ backgroundColor: activeCombinationId === row.original.id ? 'rgba(0, 0, 0, 0.05)' : '' }} className="app-table-row flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setActiveCombinationId(activeCombinationId && activeCombinationId === row.original.id ? null : row.original.id)}>
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
                <div className="flex flex-col gap-y-3 items-center justify-center px-4 py-6 border-b-[1px] border-x-[1px] border-gray-200 rounded-b-sm">
                    <div className="flex flex-col gap-y-0.5 items-center">
                        <LuGrid2X2 className="size-6 text-blue-800 mb-1"/>
                        <h2 className="text-sm font-medium">You do not have any combinations yet.</h2>
                        <p className="text-xs text-gray-600">You need at least two grounds to start creating combinations.</p>
                    </div>
                    <button onClick={() => setIsAddCombinationModalOpen(true)} type="button" disabled={!hasGrounds} className={`flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 border-gray-200 hover:bg-gray-50 transition-colors ${hasGrounds ? "cursor-pointer" : "cursor-not-allowed"}`}>
                        <span className="text-xs">Add Combination</span>
                    </button>
                </div>
            }
        </div>
    )
};

export default function Layout() {
    const [activeGroundId, setActiveGroundId] = useState<string | null>(null);
    const [activeCombinationId, setActiveCombinationId] = useState<string | null>(null);
    const [isAddGroundModalOpen, setIsAddGroundModalOpen] = useState(false);
    const [isAddCombinationModalOpen, setIsAddCombinationModalOpen] = useState(false);

    const [isEditGroundModalOpen, setIsEditGroundModalOpen] = useState(false);
    const [isEditCombinationModalOpen, setIsEditCombinationModalOpen] = useState(false);

    const layoutSidebarProps = {
        activeGroundId,
        activeCombinationId,
        setIsAddGroundModalOpen,
        setIsAddCombinationModalOpen,
        setIsEditGroundModalOpen,
        setIsEditCombinationModalOpen
    };

    const groundsTableProps = {
        activeGroundId,
        setActiveGroundId,
        setIsAddGroundModalOpen
    };

    const combinationsTableProps = {
        activeCombinationId,
        setActiveCombinationId,
        setIsAddCombinationModalOpen
    };

    return (
        <>
            <AddGroundModal isOpen={isAddGroundModalOpen} onClose={() => setIsAddGroundModalOpen(false)}/>
            <AddCombinationModal isOpen={isAddCombinationModalOpen} onClose={() => setIsAddCombinationModalOpen(false)}/>
            {
                activeGroundId && 
                <EditGroundModal isOpen={isEditGroundModalOpen} onClose={() => setIsEditGroundModalOpen(false)} target={activeGroundId} key={`g-${activeGroundId}`}/>
            }
            {
                activeCombinationId && 
                <EditCombinationModal isOpen={isEditCombinationModalOpen} onClose={() => setIsEditCombinationModalOpen(false)} target={activeCombinationId} key={`c-${activeCombinationId}`}/>
            }
            <div className="flex flex-col gap-y-8 pb-7">
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-0.5">
                        <h1 className="text-[0.925rem] font-medium">Grounds</h1>
                        <p className="text-gray-500">An overview of your available single grounds for booking.</p>
                    </div>
                    <GroundsTable {...groundsTableProps} />
                </div>
                <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-0.5">
                        <h1 className="text-[0.925rem] font-medium">Combinations</h1>
                        <p className="text-gray-500">An overview of your available multi-ground combinations for booking.</p>
                    </div>
                    <CombinationsTable {...combinationsTableProps} />
                </div>
            </div>
            <LayoutSidebar {...layoutSidebarProps}/>
        </>
    )
};