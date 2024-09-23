import Image from "next/image"
import { AmenityCard } from "@/components/Amenities"
import { MapPin, Bookmark } from "lucide-react"

interface CardProps {

}

export default function Card ({} : CardProps) {
    return (
        <div className="w-80 inline-flex flex-col bg-gray-100 hover:bg-slate-100 transition-all rounded-xl cursor-pointer">
            <div className="relative w-full h-64 rounded-t-xl">
                <Image src={'https://images.pexels.com/photos/19582958/pexels-photo-19582958/free-photo-of-boys-playing-soccer-on-a-field.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'} fill alt="Pitch image" className="object-cover rounded-t-xl"/>
                <button className="absolute top-4 right-4 bg-white bg-opacity-90 p-2 rounded-full">
                    <Bookmark className="w-4 h-4 rounded-full"/>
                </button>
            </div>
            <div className="my-2 p-5 text-wrap w-full flex flex-col gap-y-5">
                <h1 className="text-center font-medium">Porto Sport Football Pitches</h1>
                <span className="text-sm flex-center gap-x-1 text-gray-700"><MapPin className="w-4 h-4"/>Al-Seyouf</span>
                <p className="text-gray-600 text-sm overflow-hidden line-clamp-3">Lorem ipsum, dolor sit amet consectetur adipisicing elit. Ut repellat aut ipsa possimus fugit earum delectus eius soluta odit esse neque praesentium recusandae dignissimos aliquam, dolor perferendis, libero sed fugiat?</p>
                <div className="flex items-center justify-around mt-2">
                    <AmenityCard name="Indoors" expanded={false}/>
                    <AmenityCard name="Seating" expanded={false}/>
                    <AmenityCard name="Showers" expanded={false}/>
                </div>
            </div>
        </div>
    )
}

{/* Save this card */}
{/* rating */}
{/* price */}
{/* amenities */}