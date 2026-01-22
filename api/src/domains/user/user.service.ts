import * as argon2 from "argon2";

import prisma from "@/shared/lib/prisma";
import { createUserPayload } from "@/domains/user/user.validator";

export default class UserService {
    fetchUserByPhone = async (phone: string, strip: boolean = false) => {
        const user = await prisma.user.findUnique({ 
            where: { phone },
            ...(strip && { 
                omit: { password: true } 
            }),
        });

        return user;
    };

    createUser = async (payload: createUserPayload) => {
        const user = await prisma.user.create({ 
            data: {
                ...payload
            },
            omit: {
                password: true
            }
        });
        
        return user;
    };

    updatePassword = async (id: string, password: string) => {
        const newHash = await argon2.hash(password);
        
        const user = await prisma.user.update({
            where: { id },
            data: { password: newHash }
        });

        return user;
    }
};
