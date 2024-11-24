import createPitch from "@/utils/pitch/create";
import PitchType from "@/utils/types/pitch";
import { NextRequest, NextResponse } from "next/server";

export async function POST (request: NextRequest) {
    const data = await request.json();

    if (!data.email || !data.pitch) {
        return NextResponse.json({message: "Please provide all required fields.", status: 400}, {status: 400});
    }

    const res = await createPitch(data.email as string, data.pitch as PitchType);
    return NextResponse.json({message: res.message, status: res.status}, {status: res.status});
}