import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils';
import { NextResponse } from 'next/server'

export async function POST (req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = body;
        const hashed = await hashPassword(password);

        const user = await prisma.user.findUnique({
            where: {
                email: email
            }
        });

        if (user != null) {
            return NextResponse.json({
                user: null
            }, { status: 409 })
        };

        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashed
            }
        })

        return NextResponse.json({
            user: newUser
        }, { status: 201 })

    } catch (error) {
        return NextResponse.json({
            user: null
        }, {status: 500})
    }
}