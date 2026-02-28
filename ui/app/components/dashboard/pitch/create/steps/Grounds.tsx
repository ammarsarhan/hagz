import { motion } from "framer-motion";
import ReactGridLayout, { Layout, noCompactor, useContainerWidth } from "react-grid-layout";

import useFormContext from "@/app/context/Form";
import { EntranceAxis, EntrancePosition, groundSizeOptions, groundSportOptions, Pitch } from "@/app/utils/types/dashboard";
import { defaults } from "@/app/utils/dashboard/config";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function Grounds() {
    const { data, setData } = useFormContext<Pitch>();
    const { width, containerRef, mounted } = useContainerWidth();

    const isVertical = data.layout.entrance.axis === "TOP" || data.layout.entrance.axis === "BOTTOM";

    const layout: Layout = data.layout.grounds.map(ground => ({
        i: ground.id,
        x: ground.x,
        y: ground.y,
        w: defaults.GROUND_SIZES[ground.size].width ?? ground.w,
        h: defaults.GROUND_SIZES[ground.size].height ?? ground.h,
    }));

    const handleLayoutChange = (newLayout: Layout) => {
        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                grounds: prev.layout.grounds.map(g => {
                    const updated = newLayout.find(l => l.i === g.id);

                    return updated
                        ? {
                            ...g,
                            x: updated.x,
                            y: updated.y,
                            w: updated.w,
                            h: updated.h
                        }
                        : g;
                })
            }
        }));
    };
    
    const computeEntranceStyle = (axis: EntranceAxis, position: EntrancePosition) => {
        let base = `absolute flex-center gap-x-1 z-99 ${isVertical ? "w-22" : "h-22"}`;

        switch (axis) {
            case "TOP":
                base += " top-0";
                break;
            case "BOTTOM":
                base += " bottom-0";
                break;
            case "LEFT":
                base += " left-0";
                break;
            case "RIGHT":
                base += " right-0";
                break;
        };

        switch (position) {
            case "START":
                if (axis === "TOP" || axis === "BOTTOM") base += " left-0";
                if (axis === "LEFT") base += " top-0";
                if (axis === "RIGHT") base += " top-0";
                break;
            case "CENTER":
                if (axis === "TOP" || axis === "BOTTOM") base += " left-1/2 -translate-x-1/2";
                if (axis === "LEFT") base += " top-1/2 -translate-y-1/2";
                if (axis === "RIGHT") base += " top-1/2 -translate-y-1/2";
                break;
            case "END":
                if (axis === "TOP" || axis === "BOTTOM") base += " right-0";
                if (axis === "LEFT") base += " bottom-0";
                if (axis === "RIGHT") base += " bottom-0";
                break;
        }

        return base;
    }

    return (
        <div ref={containerRef} className="w-full h-full">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full h-full border border-gray-200"
            >
                <div className={computeEntranceStyle(data.layout.entrance.axis, data.layout.entrance.position)}>
                    <div className={`bg-blue-200 ${isVertical ? "w-full h-1" : "h-full w-1"}`}></div>
                    <div className={`absolute flex-center py-1 px-2 rounded-full bg-secondary`}>
                        <span className={`text-white text-xs font-medium ${!isVertical ? "[writing-mode:vertical-rl]" : ""}`}>Entrance</span>
                    </div>
                </div>
                {
                    mounted &&
                    <ReactGridLayout
                        layout={layout}
                        width={width}
                        gridConfig={{ cols: 16, rowHeight: 50 }}
                        dragConfig={{ enabled: true }}
                        resizeConfig={{ enabled: false }}
                        compactor={noCompactor}
                        onLayoutChange={handleLayoutChange}
                    >
                        {
                            data.layout.grounds.map(ground => (
                                <div key={ground.id} className="bg-gray-200 flex-center flex-col select-none">
                                    <h1 className="text-sm font-medium mb-2">{ground.name}</h1>
                                    <div className="text-center flex flex-col gap-y-0.5 text-xs">
                                        <span>{groundSizeOptions.find(g => g.value === ground.size)!.label} {groundSportOptions.find(g => g.value === ground.sport)!.label} {ground.sport === "FOOTBALL" ? "Ground" : "Court"}</span>
                                        <span>EGP {ground.basePrice}.00/hr</span>
                                    </div>
                                </div>
                            ))
                        }
                    </ReactGridLayout>
                }
            </motion.div>
        </div>
    );
}