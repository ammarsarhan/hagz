export default function pulse ({ className } : { className: string }) {
    return (
        <div className={`w-5 h-5 rounded-md pulse ${className}`}>
        </div>
    )
}