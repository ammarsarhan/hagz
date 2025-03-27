import Card, { PitchDataType } from "@/components/card";

export default function Grid ({ pitches } : { pitches : PitchDataType[] }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(325px,1fr))] gap-2 p-4 mt-2 mb-4">
            {
                pitches.map((pitch, index) => {
                    return <Card key={index} id={pitch.id} name={pitch.name} images={pitch.images} amenities={pitch.amenities} priceRange={pitch.priceRange} coordinates={pitch.coordinates} location={pitch.location} updatedAt={pitch.updatedAt} />
                })
            }
        </div>
    )
}