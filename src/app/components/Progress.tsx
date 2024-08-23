import { CheckIcon } from "@radix-ui/react-icons";

interface ProgressProps {
    current: number
    labels: string[],
    variant?: string
}

// We want to create a progress component with steps separated by dashes
// Step should have three states: complete, active, and inactive

// Complete: Circle with lighter fill and checkmark
// Active: Circle with darker fill and number of step
// Inactive: Circle with border and number of step

// Inactive =  Current Index + 1 - Total
// Active = Current Index
// Complete = 0 - Current Index - 1

export default function Progress ({current, labels, variant = "default"}: ProgressProps) {
    // Set variable for global style across all steps
    const separator = "after:h-[1px] after:w-5 after:bg-black after:rounded-full last:after:hidden";

    const Complete = ({label}: {label: string}) => (
        <div className={`flex-center gap-x-2 ${separator}`}>
            <div className="flex-center w-5 h-5 rounded-full bg-black text-white">
                <CheckIcon className="text-xs"/>
            </div>
            <span className="text-sm hidden sm:block">{label}</span>
        </div>
    )

    const Active = ({label, index}: {label: string, index: number}) => (
        <div className={`flex-center gap-x-2 ${separator}`}>
            <div className="flex-center w-5 h-5 p-2 rounded-full border-[1px] border-gray-700 bg-primary text-secondary">
                <span className="text-xs">{index + 1}</span>
            </div>
            <span className="text-sm">{label}</span>
        </div>
    )

    const Inactive = ({label, index}: {label: string, index: number}) => (
        <div className={`flex-center gap-x-2 ${separator}`}>
            <div className="flex-center w-5 h-5 p-2 rounded-full border-[1px] border-gray-700 bg-white bg-opacity-20 text-primary">
                <span className="text-xs">{index + 1}</span>
            </div>
            <span className="text-sm hidden sm:block">{label}</span>
        </div>
    )

    return (
        <div className="flex flex-col items-start justify-center gap-y-4 py-8">        
            <div className="flex gap-2">
                {
                    labels.map((label, index) => {
                        if (index < current) {
                            return <Complete key={index} label={label}/>
                        }
                        if (current == index) {
                            return <Active key={index} label={label} index={index}/>
                        }
                        if (index > current) {
                            return <Inactive key={index} label={label} index={index}/>
                        }
                    })
                }
            </div>
        </div>
    )
}