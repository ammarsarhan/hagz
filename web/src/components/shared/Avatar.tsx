interface AvatarProps {
    label: string,
    className?: string,
    onClick?: () => void
}

export default function Avatar({ label, className, onClick }: AvatarProps) {
    return (
        <div onClick={onClick} className={`flex-center size-9 rounded-full bg-gray-50 border border-gray-200 transition-colors text-sm ${className}`}>
            <span className="font-medium">{label}</span>
        </div>
    );
}