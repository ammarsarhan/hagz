import z from "zod";
import prisma from "@/shared/lib/prisma";

import { createUserPayload } from "@/domains/user/user.validator";

export default class UserService {
    fetchUserByPhone = async (phone: string) => {
        const user = await prisma.user.findUnique({ where: { phone } });
        return user;
    };

    createUser = async (payload: createUserPayload) => {
        const user = await prisma.user.create({ 
            data: {
                ...payload
            } 
        });
        
        return user;
    };
};
