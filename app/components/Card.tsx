interface CardProps {

}

export default function Card ({} : CardProps) {
    return (
        <div className="w-80 h-96 inline-flex flex-col bg-gray-100 rounded-xl p-5">
            <span>Pitch Name</span>
            <span>Location</span>
            <span>Price</span>
        </div>
    )
}