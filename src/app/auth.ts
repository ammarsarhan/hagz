import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/app/prisma'


export const { handlers, signIn, signOut, auth } = NextAuth ({
    adapter: PrismaAdapter(prisma),
    providers: []
})