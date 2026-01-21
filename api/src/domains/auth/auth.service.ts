import z from 'zod';
import prisma from "@/shared/lib/prisma";
import { InternalServerError } from '@/shared/error';

export default class AuthService {
    signUpUser = async (data: any) => {
        return data;
    }
}