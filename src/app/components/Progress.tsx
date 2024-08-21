import { CheckIcon } from "@radix-ui/react-icons";

interface ProgressProps {
    current: number
    count: number,
    labels?: string[],
    variant?: string
}

// We want to create a progress component with steps separated by dashes
// Step should have three states: complete, active, and inactive

// Complete: Circle with lighter fill and checkmark
// Active: Circle with darker fill and number of step
// Inactive: Circle with border and number of step

export default function Progress ({current, count, labels, variant = "default"}: ProgressProps) {
    // Set variable for global style across all steps
    const separator = "after:h-[1px] after:w-5 after:bg-black after:rounded-full";

    return (
        <div className="flex flex-col items-start justify-center gap-y-4 py-8">        
            <div className="flex gap-x-2">
                {/* Complete */}
                <div className={`flex-center gap-x-2 ${separator}`}>
                    <div className="flex-center w-5 h-5 rounded-full bg-black text-white">
                        <CheckIcon className="text-xs"/>
                    </div>
                    <span className="text-sm">Label</span>
                </div>
                {/* Active */}
                <div className={`flex-center gap-x-2 ${separator}`}>
                    <div className="flex-center w-5 h-5 p-2 rounded-full border-[1px] border-gray-700 bg-primary text-secondary">
                        <span className="text-xs">2</span>
                    </div>
                    <span className="text-sm">Label</span>
                </div>
                {/* Inactive */}
                <div className="flex-center gap-x-2">
                    <div className="flex-center w-5 h-5 p-2 rounded-full border-[1px] border-gray-700 bg-white bg-opacity-20 text-primary">
                        <span className="text-xs">3</span>
                    </div>
                    <span className="text-sm">Label</span>
                </div>
            </div>
        </div>
    )
}