import { FaCheck } from "react-icons/fa6";

export function PathLink({ isSelected, icon, title, description, className, onClick } : { isSelected: boolean, icon?: React.ReactNode, title: string, description?: string, className?: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick} 
            className={`px-4 py-3 border-[1px] rounded-md flex items-center cursor-pointer ${className ?? ""}`} 
            style={{
                borderColor: isSelected ? "#155dfc" : "#e5e7eb",
                backgroundColor: isSelected ? "#eff6ff" : "#ffffff", 
            }}
            type="button"
        >
            <div className="flex items-center flex-1">
                {icon}
                <div className={`text-left flex-1 ${icon ? "px-4" : description ? "pr-4" : "pr-3"}`}>
                    <span className="font-medium">{title}</span>
                    {description && <p className="text-gray-500">{description}</p>}
                </div>
            </div>
            <div className={`${description ? "size-5" : "size-4"} rounded-full flex items-center justify-center border-[1px]`} style={{
                borderColor: isSelected ? '#155dfc' : '#e5e7eb', 
                backgroundColor: isSelected ? '#155dfc' : 'white'
            }}>
                {
                    isSelected && <FaCheck className={`${description ? "size-3" : "size-2.5"}`} style={{ color: isSelected ? '#e5e7eb' : 'white' }}/>
                }
            </div>
        </button>
    )
}