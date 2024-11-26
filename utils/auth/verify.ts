import { verify, sign, JwtPayload, JsonWebTokenError } from "jsonwebtoken";
import prisma from "@/utils/db";
import { SES } from "aws-sdk";
import { v4 as uuidv4 } from 'uuid';

export async function sendOwnerVerificationEmail (name: string, email: string, token?: string) {
    const jti = uuidv4();

    await prisma.owner.update({
        where: { email },
        data: {
            verificationId: jti
        }
    })

    token = sign({
        email: email
    }, process.env.JWT_SECRET as string, 
    {
        expiresIn: "30m",
        jwtid: jti
    });

    const link = `http://localhost:3000/api/auth/owner/verify?id=${jti}&token=${token}`;
    const ses = new SES({
        region: 'eu-central-1',
    });

    const data = {
        name: name,
        verification_link: link
    };

    const options = {
        Source: "ammarsarhan06@gmail.com",
        Destination: {
            ToAddresses: [email]
        },
        Template: "OwnerVerification",
        TemplateData: JSON.stringify(data)
    }

    ses.sendTemplatedEmail(options, (error, data) => {
        if (error) {
            return error.message;
        }
        return data.MessageId;
    })
}

export async function isOwnerVerified(email: string) {
    const owner = await prisma.owner.findUnique({
        where: { email }
    });

    if (owner && owner.emailStatus === "Verified") {
        return true;
    }

    return false;
}

export async function verifyOwner(id: string, token: string) {
    try {
        const decoded = verify(token, process.env.JWT_SECRET as string, {
            jwtid: id
        });

        if (typeof decoded === "string") {
            return {
                message: "Invalid token.",
                result: false
            };
        } else {
            decoded as JwtPayload;
        }

        const owner = await prisma.owner.findUnique({
            where: { email: decoded.email }
        });

        if (!owner || owner.emailStatus === "Verified") {
            return {
                message: "Invalid owner account or owner has already been verified.",
                result: false
            };
        }

        if (owner.verificationId != id) {
            return {
                message: "This verification link has already expired. Please request a new one.",
                result: false
            }
        }

        await prisma.owner.update({
            where: { email: owner.email },
            data: {
                emailStatus: "Verified",
                verificationId: null
            },
        });
        
        return {
            message: "Owner account has been verified successfully.",
            result: true
        }
    } catch (error) {
        return {
            message: `Could not validate token: ${(error as JsonWebTokenError).message}`,
            result: false
        };
    }
}