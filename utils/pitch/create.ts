import PitchType from "@/utils/types/pitch";
import prisma from "@/utils/db";
import { Amenity, PitchSizeType } from "@prisma/client";

export default async function createPitch(email: string, pitch: PitchType) {
    let owner;
    
    owner = await prisma.owner.findUnique({
        where: {
            email: email,
            emailStatus: "Verified"
        }
    });

    if (!owner) {
        return {
            message: "Owner with specified email does not exist or is not verified yet.",
            status: 404
        }
    }
    
    const duplicate = await prisma.pitch.findFirst({
        where: {
            name: pitch.name,
            ownerId: owner.id
        }
    })

    if (duplicate) {
        return {
            message: "Owner may not create two pitches with the same name!",
            status: 400
        }
    }

    if (pitch.name == "") {
        return {
            message: "Pitch name cannot be empty.",
            status: 400
        }
    }

    if (pitch.location.address == "" || pitch.location.governorate == "" || pitch.location.street == "") {
        return {
            message: "Location must be fully specified.",
            status: 400
        }
    }

    if (pitch.activePricingPlan.price < 100 || pitch.activePricingPlan.price > 9999) {
        return {
            message: "Pitch price must be a valid integer between 100 and 9999.",
            status: 400
        }
    }

    let size = "Five" as PitchSizeType;

    switch (pitch.pitchSize) {
        case "5-A-Side":
            size = "Five";
            break;
        case "7-A-Side":
            size = "Seven";
            break;
        case "11-A-Side":
            size = "Eleven";
            break;
    }

    const amenities = pitch.amenities.map(el => el.replace(/\s+/g, '') as Amenity);
    const pricingPlan = pitch.activePricingPlan;

    try {
        const created = await prisma.pitch.create({
            data: {
                name: pitch.name,
                description: pitch.description,
                groundType: pitch.groundType,
                pitchSize: size,
                images: pitch.images,
                location: {
                    ...pitch.location
                },
                rating: 0,
                amenities: [...amenities],
                activePricingPlan: {
                    ...pricingPlan
                },
                pricingPlans: [
                    {
                        ...pricingPlan
                    }
                ],
                reservations: {
                    create: []
                },
                ownerId: owner.id
            }
        })

        if (!created) {
            return {
                message: "Failed to create pitch. Please try again later.",
                status: 500
            }
        }

        return {
            message: "Pitch has been created successfully.",
            status: 200
        }
    } catch (error) {
        return {
            message: `Failed to create pitch with error: ${error}`,
            status: 500
        }
    }
}