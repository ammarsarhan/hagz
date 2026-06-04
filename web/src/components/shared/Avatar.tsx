interface AvatarProps {
    label: string,
    className?: string
}

export default function Avatar({ label, className }: AvatarProps) {
    return (
        <div className={`flex-center size-9 rounded-full bg-gray-50 border border-gray-200 transition-colors text-sm ${className}`}>
            <span className="font-medium">{label}</span>
        </div>
    );
}