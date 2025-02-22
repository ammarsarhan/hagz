import { createTransport } from "nodemailer";

const transporter = createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_KEY
    }
});

export async function sendUserVerificationEmail(recipient: string, link: string) {
    const mail = {
        from: process.env.GMAIL_USER,
        to: recipient,
        subject: "Hagz - Verify Your Email",
        html: `
            <p>Thank you for signing up with Hagz! Please verify your email by clicking the link below:</p>
            <a href="${link}">${link}</a>
        `,
    }

    try {
        await transporter.sendMail(mail)
    } catch (error: any) {
        throw new Error(`Failed to send verification email. ${error.message}`);
    }
}

export async function sendOwnerVerificationEmail(recipient: string, link: string) {
    const mail = {
        from: process.env.GMAIL_USER,
        to: recipient,
        subject: "Hagz - Verify Your Email",
        html: `
            <p>Thank you for signing up with Hagz! We're very excited to start working with you. Please verify your email by clicking the link below:</p>
            <a href="${link}">${link}</a>
        `,
    }

    try {
        await transporter.sendMail(mail)
    } catch (error: any) {
        throw new Error(`Failed to send verification email. ${error.message}`);
    }
}

export async function sendReservationVerificationEmail(recipient: string, link: string) {
    const mail = {
        from: process.env.GMAIL_USER,
        to: recipient,
        subject: "Hagz - Verify Owner Manual Reservation",
        html: `
            <p>An owner account is attempting to create a reservation with your phone number. Please click on the link below to confirm your reservation. If you did not request a manual reservation please ignore this email.</p>
            <a href="${link}">${link}</a>
        `,
    }

    try {
        await transporter.sendMail(mail)
    } catch (error: any) {
        throw new Error(`Failed to send verification email. ${error.message}`);
    }
}