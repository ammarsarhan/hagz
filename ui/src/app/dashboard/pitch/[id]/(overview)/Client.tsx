"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query"

import Input, { Dropdown, TextArea } from "@/app/components/dashboard/Input";
import { Amenity, amenityMap, CombinationType, GroundType, PitchDetails, PitchLayout } from "@/app/utils/types/pitch";
import { fetchPitch } from "@/app/utils/api/client";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { sizeMap, surfaceTypeMap } from "@/app/utils/types/maps";
import { currencyFormat } from "@/app/utils/currency";
import { LuGitPullRequestCreateArrow, LuGrid2X2 } from "react-icons/lu";

type PitchOverviewType = PitchDetails & { layout: PitchLayout };

const parseData = (data: PitchOverviewType) => {
    return {
        ...data,
        taxId: data.taxId || '',
        basePrice: String(data.basePrice),
        longitude: String(data.longitude),
        latitude: String(data.latitude),
        amenities: data.amenities as Amenity[]
    };
};

const GroundsTable = ({ data } : { data: GroundType[] }) => {
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
    
    return (
        <div className="w-full text-[0.8125rem]">
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
                        <div key={row.id} className="flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors cursor-pointer">
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
                    <button type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                        <span className="text-xs">Add Ground</span>
                    </button>
                </div>
            }
        </div>
    )
};

const CombinationsTable = ({ data, grounds } : { data: CombinationType[], grounds: GroundType[] }) => {
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
                const names = info.getValue<string[]>();
                
                if (!Array.isArray(names) || names.length === 0) {
                    return <span>-</span>;
                };

                return (
                    <div className="flex justify-center gap-x-2 gap-y-1.5 flex-wrap">
                    {
                        grounds.filter((ground: GroundType) => names.includes(ground.id)).map((ground: GroundType) => ground.name).map((name: string, i: number) => (
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

    return (
        <div className="w-full text-[0.8125rem]">
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
                        <div key={row.id} className="flex w-full border-b-[1px] border-x-[1px] border-gray-200 last:rounded-b-sm hover:bg-gray-50 transition-colors cursor-pointer">
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
                    <button type="button" className="flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-4 py-2 border-gray-200 hover:bg-gray-50 transition-colors">
                        <span className="text-xs">Add Combination</span>
                    </button>
                </div>
            }
        </div>
    );
};

export default function Client({ id } : { id: string }) {
    const queryClient = useQueryClient();

    const { data } = useQuery({
        queryFn: () => fetchPitch(id),
        queryKey: ["dashboard", "pitch", id, "home"],
        initialData: () => queryClient.getQueryData(["dashboard", "pitch", id, "home"])
    });

    const initial = parseData(data);
    const [temp, setTemp] = useState(initial);

    console.log(temp);

    return (
        <div className="mx-6 my-4 flex flex-col gap-y-12 [&>div]:last:pb-6">
            <div className="flex flex-col gap-y-6 mt-2">
                <div className="flex items-center gap-x-16">
                    <h2 className="font-medium">Pitch Details</h2>
                </div>
                <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                    <div className="w-1/3">
                        <h3 className="font-medium mb-1">Basic Information</h3>
                        <p className="text-[0.8rem] text-gray-500">Primary information that is vital for the user to identify your pitch (e.g: Name, description, location, etc...)</p>
                    </div>
                    <div className="w-2/3 text-[0.8125rem]">
                        <div className="flex flex-col gap-y-5 py-5">
                            <div className="flex items-center w-full gap-x-4">
                                <Input 
                                    label="Name"
                                    placeholder="Pitch Name"
                                    className="flex-1"
                                    value={temp.name}
                                    onChange={(e) => setTemp(prev => ({ ...prev, name: e.target.value }))}
                                />
                                <Input 
                                    label="Tax ID"
                                    placeholder="Tax Identification Number"
                                    className="flex-1"
                                    value={temp.taxId}
                                    onChange={(e) => setTemp(prev => ({ ...prev, taxId: e.target.value }))}
                                />
                            </div>
                            <div>
                                <TextArea 
                                    label="Description"
                                    placeholder="Pitch Description"
                                    value={temp.description}
                                    onChange={(e) => setTemp(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                    <div className="w-1/3">
                        <h3 className="font-medium mb-1">Location</h3>
                        <p className="text-[0.8rem] text-gray-500">Location information to help the user reach your pitch and index for radius search (e.g: City, Google Maps link, etc...)</p>
                    </div>
                    <div className="w-2/3 text-[0.8125rem]">
                        <div className="flex flex-col gap-y-5 py-5">
                            <div className="flex flex-col gap-y-5">
                                <div className="flex items-center w-full gap-x-4">
                                    <Input 
                                        label="Street"
                                        placeholder="Pitch Name"
                                        className="flex-1"
                                        value={temp.street}
                                        onChange={(e) => setTemp(prev => ({ ...prev, street: e.target.value }))}
                                    />
                                    <Input 
                                        label="Area"
                                        placeholder="Tax Identification Number"
                                        className="flex-1"
                                        value={temp.area}
                                        onChange={(e) => setTemp(prev => ({ ...prev, area: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center w-full gap-x-4">
                                    <Input 
                                        label="City"
                                        placeholder="Pitch Name"
                                        className="flex-1"
                                        value={temp.city}
                                        onChange={(e) => setTemp(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                    <Dropdown 
                                        label="Country"
                                        className="flex-1"
                                        options={[
                                            { value: "EG", label: "Egypt" },
                                            { value: "SA", label: "Saudi Arabia" },
                                            { value: "AE", label: "United Arab Emirates" },
                                        ]} 
                                        value={temp.country}
                                        onChange={(e) => setTemp(prev => ({ ...prev, country: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center w-full [&>div>p]:max-w-1/2">
                                    <Input 
                                        label="Google Maps Link"
                                        description="Adding a Google Maps link will allow us to index your pitch for radius-based search by extracting longitude and latitude information."
                                        placeholder="Google Maps Link"
                                        className="flex-1"
                                        link={{ title: "View location", href: initial.googleMapsLink }}
                                        value={temp.googleMapsLink}
                                        onChange={(e) => setTemp(prev => ({ ...prev, googleMapsLink: e.target.value }))}
                                    />
                                </div>
                                <div className="flex items-center w-full gap-x-4">
                                    <Input 
                                        label="Longitude"
                                        placeholder="Longitude"
                                        className="flex-1 text-gray-500"
                                        value={temp.longitude}
                                        onChange={(e) => setTemp(prev => ({ ...prev, longitude: e.target.value }))}
                                        readOnly
                                    />
                                    <Input 
                                        label="Latitude"
                                        placeholder="Latitude"
                                        className="flex-1 text-gray-500"
                                        value={temp.latitude}
                                        onChange={(e) => setTemp(prev => ({ ...prev, latitude: e.target.value }))}
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-x-6 border-gray-200 border-b-[1px]">
                    <div className="w-1/3">
                        <h3 className="font-medium mb-1">Additional Information</h3>
                        <p className="text-[0.8rem] text-gray-500">More information to make your pitch more appealing to users (e.g: Amenities, featured, etc...)</p>
                    </div>
                    <div className="w-2/3 text-[0.8125rem]">
                        <div className="flex flex-col gap-y-5 py-5">
                            <div className="flex flex-col gap-y-5">
                                <div className="flex flex-col gap-y-3">
                                    <span className="text-sm">Amenities ({temp.amenities.length})</span>
                                    {
                                        temp.amenities.length > 0 &&
                                        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                                            {
                                                temp.amenities.map((amenity: Amenity, index: number) => <li className="px-4 py-1.5 border-[1px] border-blue-700 text-blue-700 rounded-full" key={index}>{amenityMap.get(amenity)}</li>)
                                            }
                                        </ul>
                                    }
                                    <button onClick={() => null} type="button" className="mt-1 flex items-center justify-center gap-x-1.5 rounded-md border-[1px] px-3 py-2 border-gray-300 hover:bg-gray-100 transition-colors w-fit cursor-pointer">
                                        
                                        <span className="text-xs">Edit Amenities</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-y-6">
                <div>
                    <h2 className="font-medium">Pitch Layout</h2>
                </div>
                <div className="flex flex-col gap-y-8 border-gray-200 border-b-[1px] pb-6">
                    <div>
                        <div className="flex flex-col gap-y-0.5 mb-4">
                            <h3 className="font-medium">Grounds</h3>
                            <p className="text-gray-500 text-[0.8rem]">Individual booking units that can be combined to form combinations or booked as a single ground.</p>
                        </div>
                        <GroundsTable data={temp.layout.grounds}/>
                    </div>
                    <div>
                        <div className="flex flex-col gap-y-0.5 mb-4">
                            <h3 className="font-medium">Combinations</h3>
                            <p className="text-gray-500 text-[0.8rem]">Collections of individual booking grounds that can be opened onto each other to form a larger playing space.</p>
                        </div>
                        <CombinationsTable data={temp.layout.combinations} grounds={temp.layout.grounds}/>
                    </div>
                </div>
            </div>
        </div>
    )
}