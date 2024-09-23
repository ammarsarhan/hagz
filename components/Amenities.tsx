import { DoorClosed, Ambulance, Armchair, Lightbulb, ParkingCircle, ShowerHead, Shirt, Utensils, Lock } from "lucide-react"

const mock = ["Indoors", "BallProvided", "Seating", "NightLights", "Parking", "Showers", "ChangingRooms", "Cafeteria", "FirstAid", "Security"]

interface AmenityProps {
    name: string
    expanded?: boolean
}

export function AmenityCard ({ name, expanded = true } : AmenityProps) {
    const textStyle = `text-sm ${expanded ? 'hidden md:block' : 'hidden'}`;

    switch (name) {
        case "Indoors":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <DoorClosed className="w-4 h-4"/>
                    <span className={textStyle}>Indoors</span>
                </div>
            )
        case "BallProvided":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <DoorClosed className="w-4 h-4"/>
                    <span className={textStyle}>Ball Provided</span>
                </div>
            )
        case "Seating":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <Armchair className="w-4 h-4"/>
                    <span className={textStyle}>Seating</span>
                </div>
            )
        case "NightLights":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <Lightbulb className="w-4 h-4"/>
                    <span className={textStyle}>Night Lights</span>
                </div>
            )
        case "Parking":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <ParkingCircle className="w-4 h-4"/>
                    <span className={textStyle}>Parking</span>
                </div>
            )
        case "Showers":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <ShowerHead className="w-4 h-4"/>
                    <span className={textStyle}>Showers</span>
                </div>
            )
        case "ChangingRooms":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <Shirt className="w-4 h-4"/>
                    <span className={textStyle}>Changing Rooms</span>
                </div>
            )
        case "Cafeteria":
            return (
                <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                    <Utensils className="w-4 h-4"/>
                    <span className={textStyle}>Cafeteria</span>
                </div>
            )
            case "FirstAid":
                return (
                    <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                        <Ambulance className="w-4 h-4"/>
                        <span className={textStyle}>First Aid</span>
                    </div>
                )
            case "Security":
                return (
                    <div className="flex-center gap-x-2 bg-gray-200 w-fit py-2 px-4 rounded-xl">
                        <Lock className="w-4 h-4"/>
                        <span className={textStyle}>Security</span>
                    </div>
                )
        }
}

export default function Amenities({items} : {items: number}) {
    return (
        <div className="flex flex-wrap justify-around gap-x-10 gap-y-5 p-5 bg-gray-100 rounded-xl">
            {
                mock.slice(0, items).map((amenity, index) => {
                    return <AmenityCard name={amenity} key={index}/>
                })
            }
        </div>
    )
}