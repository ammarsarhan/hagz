import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/utils';
import { NextResponse } from 'next/server'
import * as z from 'zod'

const nameSchema = z.string().min(1, 'Please enter your name');
const emailSchema = z.string().min(1, 'Please enter an email').email({ message: 'Invalid email address' });

const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be greater than 8 characters' })
  .max(32, { message: 'Password must be greater than 32 characters' })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[0-9]/.test(password), { message: 'Password must contain at least one number' })
  .refine((password) => /[!@#$%^&*-_]/.test(password), {
    message: 'Password must contain at least one special (!@#$_%^&*-) character',
  });

const userSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema
})

export async function POST (req: Request) {
    try {
        const body = await req.json();
        const { name, email, password } = userSchema.parse(body);
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