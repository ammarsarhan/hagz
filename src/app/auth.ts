import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { AuthError, CredentialsSignin } from 'next-auth'

import { hashPassword } from '../lib/utils'

import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'

const providers = [
    Credentials ({
        credentials: {
            email: {},
            password: {}
        },
        authorize: async (credentials) => {
            let user = null;

            const {email, password} = credentials;
            const hashed = await hashPassword(password as string);

            user = await prisma.user.findUnique({
                where: {
                    email: email as string
                }
            })

            if (!user) {
                throw new CredentialsSignin("User Not Found");
            }

            const isValidPassword = (hashed == user.password) ? true : false;
            
            if (!isValidPassword) {
                throw new CredentialsSignin("Invalid Credentials");
            }

            return {
                'email': user.email,
                'emailVerified': user.emailVerified,
                'name': user.name,
                'id': user.id,
                'image': user.image
                // 'role': user.role
            };
        }
    })
]

const pages = {
    signIn: '/user/auth/sign-in',
    signOut: '/user/sign-out',
    error: '/user/auth/error',
    verifyRequest: '/user/auth/verify-request',
    newUser: '/user/auth/sign-up',
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: providers,
    pages: pages
})