import { MutationProps } from "@/app/dashboard/pitches/create/Form";
import { BillingMethod, PayoutRate, PitchStatus, PitchType } from "@/app/utils/types/pitch";
import { Invitation } from "@/app/utils/types/invitation";
import { ManagerPermissions } from "@/app/utils/types/manager";
import { OnboardingStage } from "@/app/utils/types/dashboard";

export async function fetchDashboard() {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard`;

    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json"
        },
        credentials: "include"
    });

    const { data } = await res.json();

    const user = data.user;
    const pitches = data.pitches as PitchType[];
    const stage = data.stage as OnboardingStage;

    return { user, pitches, stage };
};

export async function fetchPitchState(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/general`;
    
    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json"
        },
        credentials: "include"
    });

    const { data } = await res.json();
    return data;
};

export async function fetchPitch(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}`;

    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json"
        },
        credentials: "include"
    });

    const { data } = await res.json();
    return data;
};

export async function fetchPitchSettings(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/settings`; 

    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include"
    });

    const { data } = await res.json();
    return data;
};

interface UpdatePitchSettingsPayload {
    automaticBookings: string;
    depositFee: string;
    minBookingHours: string;
    maxBookingHours: string;
    cancellationGrace: string;
    cancellationFee: string;
    noShowFee: string;
    advanceBooking: string;
    peakHourSurcharge: string;
    offPeakDiscount: string;
    payoutRate: PayoutRate;
    payoutMethod: BillingMethod;
}

export async function updatePitchSettings(id: string, settings: UpdatePitchSettingsPayload) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/settings`;

    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ settings })
    });

    const data = await res.json();
    return data;
}

interface CreateInvitationPayload {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    message: string | null;
    expiresIn: "1" | "7" | "30";
}

export async function createInvitation(data: CreateInvitationPayload) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/invitation/create`;

    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify(data)
    });
    
    const invitation = await res.json();
    console.log(invitation);

    if (!res.ok) {
        throw new Error(invitation.message || "Failed to create invitation. Please try again later.");
    };

    return invitation;
};

export async function updatePitchDraft({ key, payload } : MutationProps) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard/pitches/create`

    const res = await fetch(target, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
            step: key, 
            data: payload 
        }),
    });

    const data = await res.json();
    
    if (!res.ok) throw new Error(data.message);
    return data;
};

export async function fetchInvitation(token: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/invitation/${token}`;

    // Client-side request - cookies are automatically included.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include"
    });

    const { data } = await res.json();
    return data as Omit<Invitation, "email">;
};

export interface SignInPayloadType {
    email: string;
    password: string;
}

export async function signInWithCredentials(payload: SignInPayloadType) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/sign-in`;
    
    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ...payload })
    });

    const { message, data } = await res.json();
    
    if (!res.ok) throw new Error(message);

    return data;
}

export interface OwnerPayloadType {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
}

export async function createOwner(payload: OwnerPayloadType) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/sign-up`;
    
    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ...payload, role: "OWNER" })
    });

    const { message, data } = await res.json(); 
    
    if (!res.ok) throw new Error(message);

    return data;
};

export interface ManagerPayloadType {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    token: string;
}

export async function createManager(payload: ManagerPayloadType) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/auth/sign-up`;
    
    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ...payload, role: "MANAGER" })
    });

    const { message, data } = await res.json(); 
    
    if (!res.ok) throw new Error(message);

    return data;
};

export async function updatePitchState(state: PitchStatus, id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/status`;

    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action: state })
    });

    const { message, data } = await res.json(); 
    
    if (!res.ok) throw new Error(message);

    return data;
};

export async function updatePitchPermissions(manager: string, payload: Omit<ManagerPermissions, "pitchId" | "managerId">, id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/permissions`;

    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ id: manager, permissions: payload })
    });

    const { message, data } = await res.json(); 
    
    if (!res.ok) throw new Error(message);

    return data;
};

export async function fetchPitches() {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard/pitches`;

    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include"
    });

    const { data } = await res.json();
    return data;
};

export async function updateInvitation(action: "ACCEPT" | "REJECT", token: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/invitation/${token}`;

    const res = await fetch(target, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action })
    });

    const { message, data } = await res.json();

    if (!res.ok) throw new Error(message);
    return data;    
} 
