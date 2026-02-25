import { motion } from "framer-motion";
import ReactGridLayout, { Layout, useContainerWidth } from "react-grid-layout";

import useFormContext from "@/app/context/Form";
import { Pitch } from "@/app/utils/types/dashboard";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function Grounds() {
    const { data, setData } = useFormContext<Pitch>();
    const { width, containerRef, mounted } = useContainerWidth();

    const layout = data.layout.grounds.map(ground => ({
        i: ground.id,
        x: ground.x,
        y: ground.y,
        w: ground.width,
        h: ground.height
    }));

    const handleLayoutChange = (newLayout: Layout) => {
        setData(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                grounds: prev.layout.grounds.map(g => {
                    const updated = newLayout.find(l => l.i === g.id);

                    return updated
                        ? { ...g, x: updated.x, y: updated.y, w: updated.w, h: updated.h }
                        : g;
                })
            }
        }));
    };

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full bg-gray-50"
        >
            {
                mounted && (
                    <ReactGridLayout
                        layout={layout}
                        width={width}
                        gridConfig={{ cols: 12, rowHeight: 30 }}
                        onLayoutChange={handleLayoutChange}
                    >
                        {
                            data.layout.grounds.map(ground => (
                                <div key={ground.id} className="bg-gray-200 flex items-center justify-center">
                                    {ground.name}
                                </div>
                            ))
                        }
                    </ReactGridLayout>
                )
            }   
        </motion.div>
    );
}