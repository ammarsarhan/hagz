export default function Modal({ onClose, children, className } : { onClose: () => void, children: React.ReactNode, className?: string }) {
    return (
        <div className="flex-center fixed top-0 left-0 w-screen h-screen bg-black/75 z-999">
            <div className="bg-gray-200 rounded-md p-2">
                <div className={`bg-white rounded-md border border-gray-300 p-4 ${className}`}>
                    {children}
                </div>
            </div>
        </div>
    )
}