import { verify, sign, JwtPayload, JsonWebTokenError } from "jsonwebtoken";
import prisma from "@/utils/db";
import { v4 as uuidv4 } from 'uuid';
import { createTransport } from "nodemailer";

export async function sendOwnerVerificationEmail (name: string, email: string, token?: string) {
    const jti = uuidv4();

    try {
        await prisma.owner.update({
            where: { email },
            data: {
                verificationId: jti
            }
        })
    } catch (error) {
        return {
            message: "Could not generate verification link. Please try again later.",
            result: false
        }
    }

    token = sign({
        email: email
    }, process.env.JWT_SECRET as string, 
    {
        expiresIn: "30m",
        jwtid: jti
    });

    const link = `http://localhost:3000/api/auth/owner/verify?id=${jti}&token=${token}`;
    console.log(link);

    // const transporter = createTransport({
    //     service: "gmail",
    //     auth: {
    //         user: process.env.EMAIL_USERNAME,
    //         pass: process.env.EMAIL_PASSWORD,
    //     }
    // })

    // const mailOptions = {
    //     from: process.env.EMAIL_USERNAME,
    //     to: email,
    //     subject: 'Welcome to Hagz - Verify Your Email Address',
    //     html: `
    //       <p>Thank you for signing up!</p>
    //       <p>Please click the link below to verify your email address:</p>
    //       <a href="${link}">Verify Email</a>
    //     `,
    // };

    // transporter.sendMail(mailOptions, (error, info) => {
    //     if (error) {
    //         console.log("Error occurred while sending email.", error)
    //         return {
    //             message: `Could not send verification email. Returned with error: ${error.message}`,
    //             result: false
    //         }
    //     } else {
    //         console.log("Sent email successfully.")
    //         return {
    //             message: `Verification link has been sent to your email. Returned with message: ${info.response}`,
    //             result: true
    //         };
    //     }
    // })

    return {
        message: "An unexpected error has occurred.",
        result: false
    }
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