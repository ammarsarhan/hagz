import prisma, { handlePrismaError } from "@/utils/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST (req: NextRequest) {
    try {
        const refreshCookie = req.cookies.get("refreshToken");
    
        if (!refreshCookie) {
            return NextResponse.json({message: "No refresh token found. Unable to log out.", status: 400}, {status: 400});
        }
    
        const refreshToken = refreshCookie && refreshCookie.value;
        const ownerToken = await prisma.ownerToken.findUnique({
            where: {
                token: refreshToken
            }
        })
    
        if (!ownerToken || ownerToken.revoked) {
            return NextResponse.json({message: "Invalid refresh token. Unable to log out.", status: 400}, {status: 400});
        }
    
        const revokedToken = await prisma.ownerToken.update({
            where: { token: refreshToken },
            data: { revoked: true }
        });
    
        if (!revokedToken) {
            return NextResponse.json({message: "An error has occurred while connecting to the database. Please check your network and try again.", status: 500}, {status: 500});
        }
    
        const response = NextResponse.json({message: "Successfully logged out.", status: 200}, {status: 200});
        response.cookies.delete("refreshToken");
        
        return response;
    } catch (error) {
        let message = error as Error;
        return NextResponse.json({message: handlePrismaError(message), status: 500}, {status: 500});
    }
}