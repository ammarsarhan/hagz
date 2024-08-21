interface ProgressProps {
    current: number
    count: number,
    labels?: string[],
    variant?: string
}

export default function Progress ({current, count, labels, variant = "default"}: ProgressProps) {
    // Set variable for global style across all steps
    const style = "w-5 h-1 rounded-full";

    return (
        <div className="flex flex-col items-start justify-center gap-y-4 py-8">        
            <div className="flex gap-x-4">
                
            </div>
        </div>
    )
}