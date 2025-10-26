import extractCookies from "@/app/utils/cookies";
import { PitchType } from "@/app/utils/types/pitch";
import { OnboardingStage } from "../types/dashboard";

export async function fetchPitchState(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/general`;
    const { header } = await extractCookies();
    
    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    return data;
};

export async function fetchPitch(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}`;
    const { header } = await extractCookies();
    
    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    return data;
}

export async function fetchPitchCreateState() {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard/pitches/create`;
    const { header } = await extractCookies();

    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const data = await res.json();
    
    if (!res.ok) throw new Error(data.message);
    return data;
};

export async function fetchPitchSettings(id: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/pitch/${id}/settings`;
    const { header } = await extractCookies();

    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    return data;
};

export async function fetchDashboard() {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard`;
    const { header } = await extractCookies();

    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    
    const user = data.user;
    const pitches = data.pitches as PitchType[];
    const stage = data.stage as OnboardingStage;
    
    return { user, pitches, stage };
};

export async function fetchInvitation(token: string) {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/invitation/${token}`;
    const { header } = await extractCookies();
    
    // Server-side request - append cookies to authorize access.
    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    return data;
};

export async function fetchPitches() {
    const target = `${process.env.NEXT_PUBLIC_API_URL}/dashboard/pitches`;
    const { header } = await extractCookies();

    const res = await fetch(target, {
        method: "GET",
        headers: {
            "Content-type": "application/json",
            Cookie: header,
        }
    });

    const { data } = await res.json();
    return data;
}
