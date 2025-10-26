import prisma from "@/utils/prisma";

interface UserType {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
}

interface AccountType {
    provider: "EMAIL" | "GOOGLE" | "META";
    signInMethod: "OAUTH" | "PASSWORD";
}

export async function checkIfUserExists(email: string, phone?: string) {
  return await prisma.$transaction(async (tx) => {
    // Check account record for an email provider with the email to be tested against.
    const account = await tx.account.findFirst({
      where: {
        providerId: email,
        provider: "EMAIL"
      }
    });

    if (account) return true;

    // Check user table for either email or phone.
    const user = await tx.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : [])
        ]
      }
    });

    return !!user;
  });
};

type DefaultCreateType = UserType & AccountType & { token?: string };

export async function createUser({ firstName, lastName, email, phone, password, provider, signInMethod } : DefaultCreateType) {
    // Implementation to create user within the database
    // First of all, check if an account record with the specified email or phone number exists already.

    const exists = await checkIfUserExists(email, phone);

    if (exists) {
        throw new Error("An account with this email or phone number already exists.");
    };

    // We will use prisma-provided transactions to ensure that all of the steps either happen successfully or fail together, we don't want any partial data.
    const user = await prisma.$transaction(async (tx) => {
        // Create the actual user record
        const user = await tx.user.create({
            data: {
                firstName,
                lastName,
                email,
                phone
            }
        });

        // Create an account using email + password as an access method to the created user
        await tx.account.create({
            data: {
                provider,
                providerId: email,
                signInMethod,
                password,
                userId: user.id
            }
        });

        // Create the userPreferences record within the database, to allow for modification later
        await tx.userPreferences.create({
            data: {
                userId: user.id
            }
        });

        return user;
    })

    return user;
}

export async function createOwner({ firstName, lastName, email, phone, password, provider, signInMethod } : DefaultCreateType) {
    // Implementation to create owner within the database
    // First of all, check if an account record with the specified email or phone number exists already.

    const exists = await checkIfUserExists(email, phone);

    if (exists) {
        throw new Error("An account with this email or phone number already exists.");
    };

    // We will use prisma-provided transactions to ensure that all of the steps either happen successfully or fail together, we don't want any partial data.
    const user = await prisma.$transaction(async (tx) => {
        // Create the actual user record
        const user = await tx.user.create({
            data: {
                firstName,
                lastName,
                email,
                phone
            }
        });

        // Create an account using email + password as an access method to the created user
        await tx.account.create({
            data: {
                provider,
                providerId: email,
                signInMethod,
                password,
                userId: user.id
            }
        });

        // Create the owner user metadata that is to be attached to the created user
        await tx.owner.create({
            data: {
                userId: user.id
            }
        });

        // Create the userPreferences record within the database, to allow for modification later
        await tx.userPreferences.create({
            data: {
                userId: user.id
            }
        });

        return user;
    })

    return user;
};

type ManagerCreateType = UserType & AccountType & { token: string };

export async function createManager({ firstName, lastName, email, phone, password, provider, signInMethod, token } : ManagerCreateType) {
    // Implementation to create manager within the database
    // First of all, check if an account record with the specified email or phone number exists already.
    const exists = await checkIfUserExists(email, phone);

    if (exists) {
        throw new Error("An account with this email or phone number already exists.");
    };

    // Fetch the invitation with the specified token and compare it against the email.
    const invitation = await prisma.invitation.findUnique({ where: { token } });
    
    if (!invitation || invitation.email !== email) {
        throw new Error("An email was associated with the invitation by the owner. Please use the email address specified.");
    };

    if (invitation.status != "PENDING" || invitation.expiresAt < new Date()) {
        throw new Error("This invitation has either been accepted already or is no longer valid.");
    };

    // We will use prisma-provided transactions to ensure that all of the steps either happen successfully or fail together, we don't want any partial data.
    const user = await prisma.$transaction(async (tx) => {
        // Create the actual user record
        const user = await tx.user.create({
            data: {
                firstName,
                lastName,
                email,
                phone,
                verifiedMethods: ["EMAIL"]
            }
        });

        // Create an account using email + password as an access method to the created user
        await tx.account.create({
            data: {
                provider,
                providerId: email,
                signInMethod,
                password,
                userId: user.id
            }
        });

        // Create the manager user metadata that is to be attached to the created user
        const manager = await tx.manager.create({
            data: {
                userId: user.id
            }
        });

        await tx.managerPermissions.create({
            data: {
                managerId: manager.id,
                pitchId: invitation.pitchId,
                bookings: "WRITE",
                payments: "VIEW",
                analytics: "VIEW",
                settings: "VIEW",
                schedule: "VIEW",
                scheduleExceptions: "WRITE",
            },
        });

        // Create the userPreferences record within the database, to allow for modification later
        await tx.userPreferences.create({
            data: {
                userId: user.id
            }
        });

        // Since managers can be invited, we need to update any invitations that were sent to this email to no longer require a user.
        await tx.invitation.update({
            where: {
                token
            },
            data: {
                status: "ACCEPTED",
                acceptedAt: new Date()
            }
        });

        return user;
    })

    return user;
}
