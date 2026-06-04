import { TbExclamationCircle, TbX } from "react-icons/tb"

export interface AlertProps { 
    message: string, 
    code?: string,
    onClose: () => void
};

export default function Alert({ message, code = "UNKNOWN_ERROR_OCCURRED", onClose } : AlertProps) {
    return (
        <div className="fixed right-4 top-4 p-4 rounded-md border border-red-200 max-w-sm z-99 bg-linear-to-br from-red-100 to-white"> 
            <div className="flex items-start gap-x-3.5">
                <div>
                    <TbExclamationCircle className="text-red-700"/>
                </div>
                <div className="flex flex-col gap-y-0.5">   
                    <h1 className="text-base font-medium">{message}</h1>
                    <p className="text-[0.7rem] text-gray-500">{code}</p>
                </div>
                <button onClick={onClose} className="cursor-pointer text-gray-700 hover:text-gray-500 transition-all">
                    <TbX />
                </button>
            </div> 
        </div>
    )
}