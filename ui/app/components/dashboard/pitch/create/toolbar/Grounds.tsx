import { useState } from "react";
import { motion } from "framer-motion";

import useFormContext from "@/app/context/Form";
import Button from "@/app/components/base/Button";
import GroundModal from "@/app/components/dashboard/pitch/create/modals/Ground";
import { DropdownGroup } from "@/app/components/dashboard/Dropdown";
import { EntranceAxis, entranceAxisOptions, EntrancePosition, entrancePositionOptions, Pitch } from "@/app/utils/types/dashboard";

import { TbArtboard } from "react-icons/tb";
import { FaArrowRotateRight, FaChevronLeft, FaChevronRight, FaTrash } from "react-icons/fa6";
import { MdEdit } from "react-icons/md";

export default function Grounds() {
    const { data, setData, next, previous } = useFormContext<Pitch>();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const hasGrounds = data.layout.grounds.length > 0;

    const setAxis = (axis: EntranceAxis) => {
        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                entrance: {
                    ...prev.layout.entrance,
                    axis
                }
            }
        }));
    }

    const setPosition = (position: EntrancePosition) => {
        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                entrance: {
                    ...prev.layout.entrance,
                    position
                }
            }
        }));
    };

    const handleDelete = (id: string) => {
        const grounds = data.layout.grounds.filter(g => g.id !== id);

        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                grounds
            }
        }));
    };

    return (
        <>
            <GroundModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}/>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`h-full ${hasGrounds ? "my-6" : "flex-center"}`}
            >
                {
                    hasGrounds ?
                    <div className="flex flex-col h-full justify-between mx-2">
                        <div>

                            <div className="flex flex-col gap-y-4">
                                <div className="flex flex-col gap-y-0.5">
                                    <h3 className="text-sm font-medium">Entrance</h3>
                                    <p className="text-xxs text-gray-500">Choose your layout&apos;s door/entrance position relative to your grounds.</p>
                                </div>
                                <div className="flex flex-col gap-y-3 text-xs">
                                    <DropdownGroup 
                                        onChange={(value) => setAxis(value as EntranceAxis)} 
                                        placeholder={"Select axis"} 
                                        value={data.layout.entrance.axis} 
                                        options={entranceAxisOptions} 
                                        label={"Axis"} 
                                    />
                                    <DropdownGroup 
                                        onChange={(value) => setPosition(value as EntrancePosition)} 
                                        placeholder={"Select position"} value={data.layout.entrance.position} 
                                        options={entrancePositionOptions}
                                        label={"Position"} 
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-y-4 mt-6">
                                <div className="flex flex-col gap-y-0.5">
                                    <h3 className="text-sm font-medium">Grounds</h3>
                                    <p className="text-xxs text-gray-500">A ground is the smallest bookable unit within your pitch. You may create up to 10 grounds per pitch.</p>
                                </div>
                                <div className="flex flex-col gap-y-2 text-[0.785rem]">
                                    {
                                        data.layout.grounds.map((ground, index) => {
                                            const id = ground.id;

                                            return (
                                                <div key={ground.id} className="flex items-center justify-between">
                                                    <span>{index + 1}) {ground.name}</span>
                                                    <div className="flex items-center gap-x-1">
                                                        <button className="group size-7 rounded-full flex-center hover:bg-gray-200 transition-all">
                                                            <MdEdit className="size-3 transition-all"/>
                                                        </button>
                                                        <button className="group size-7 rounded-full flex-center hover:bg-gray-200 transition-all">
                                                            <FaArrowRotateRight className="size-3 transition-all"/>
                                                        </button>
                                                        <button onClick={() => handleDelete(id)} className="group size-7 rounded-full flex-center hover:bg-gray-200 transition-all">
                                                            <FaTrash className="size-3 transition-all"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
                                    {
                                        data.layout.grounds.length < 10 ?
                                        <Button className="my-4 font-medium text-xs!" variant="mono" onClick={() => setIsModalOpen(true)}>Add Ground</Button> :
                                        <Button className="my-4 font-medium text-xs! cursor-auto!" variant="outline" disabled>Add Ground</Button>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="flex-center w-full gap-x-2">
                            <Button variant="outline" onClick={previous}>
                                <FaChevronLeft className="size-3"/>
                                <span>Previous</span> 
                            </Button>
                            <Button variant="mono" onClick={next}>
                                <span>Next</span> 
                                <FaChevronRight className="size-3"/>
                            </Button>
                        </div>
                    </div> :
                    <div className="flex-center flex-col gap-y-0.5 text-center mx-2">
                        <TbArtboard className="size-12 my-3"/>
                        <h2 className="font-medium text-[0.95rem]">You do not have any grounds yet.</h2>
                        <p className="text-[0.785rem] text-gray-600">
                            You need at least one ground within your pitch to finalize the creation process.
                        </p>
                        <Button className="my-4 font-medium text-xs!" variant="mono" onClick={() => setIsModalOpen(true)}>Add Ground</Button>
                    </div>
                }
            </motion.div>
        </>
    )
}