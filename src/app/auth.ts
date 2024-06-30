import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { hashPassword } from './lib/utils'

import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/app/prisma'

export const { handlers, signIn, signOut, auth } = NextAuth ({
    adapter: PrismaAdapter(prisma),
    providers: [
        Credentials ({
            credentials: {
                email: {},
                password: {}
            },
            authorize: async (credentials) => {
                let user = null
                const hashed = await hashPassword(credentials.password as string)

                user = await prisma.user.findUnique({
                    where: {
                        email: credentials.email as string,
                        password: hashed
                    }
                })

                if (!user) {
                    throw new Error("User not found")
                }

                return user;
            }
        })
    ]
})