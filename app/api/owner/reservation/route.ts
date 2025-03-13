import { validateAccessTokenFromRequest } from "@/utils/auth/verify";
import { NextRequest, NextResponse } from "next/server";

export async function GET (request: NextRequest) {
    const tokenData = validateAccessTokenFromRequest(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    return NextResponse.json({message: {id, tokenData}, status: 200}, {status: 200});
}