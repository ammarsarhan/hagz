import { NextRequest, NextResponse } from "next/server";
import { createOwnerWithCredentials } from "@/utils/auth/owner";
import Owner from "@/utils/types/owner";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const req = await createOwnerWithCredentials(data as Owner);

  return NextResponse.json({ message: req.message, status: req.status }, { status: req.status });
}