import { useEffect, useState } from "react";
import { CombinationType, GroundType } from "@/app/utils/types/pitch";

export const generateGridConstraints = (grounds: number, width: number) => {
    const scaleFactor = 0.75;
    const groundWidth = Math.min(Math.max((width / grounds) * scaleFactor, 250), 400);
    const groundHeight = groundWidth / 2;

    return { dimensions: [groundWidth, groundHeight] };
};

export default function LayoutGrid({
    grounds,
    combinations,
}: {
    grounds: GroundType[];
    combinations: CombinationType[];
}) {
    const [groundDimensions, setGroundDimensions] = useState<[number, number] | null>(null);
    const [orientations, setOrientations] = useState<boolean[]>([]); // true = vertical, false = horizontal

    useEffect(() => {
        const handleLayout = () => {
            const { dimensions } = generateGridConstraints(grounds.length, window.innerWidth);
            setGroundDimensions(dimensions);

            const randomOrientations = grounds.map(() => Math.random() < 0.5);
            setOrientations(randomOrientations);
        };

        handleLayout();
        window.addEventListener("resize", handleLayout);
        return () => window.removeEventListener("resize", handleLayout);
  }, [grounds]);

  if (!groundDimensions || !orientations.length) return null;

  return (
    <div
        className="w-full flex flex-wrap items-start justify-center gap-4 p-4 overflow-hidden"
    >
      {
        grounds.map((ground, index) => {
            const isVertical = orientations[index];
            const [baseW, baseH] = groundDimensions;

            const width = isVertical ? baseH : baseW;
            const height = isVertical ? baseW : baseH;

            return (
            <div
                key={index}
                className="flex items-center justify-center border border-gray-300 bg-white rounded-md text-gray-700"
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                }}
            >
                {ground.name}
            </div>
            );
        })
      }
    </div>
  );
}
