import Link from "next/link";
import { formatHour } from "@/app/utils/date";
import { CombinationType, GroundType, PitchStatus } from "@/app/utils/types/pitch";
import { currencyFormat } from "@/app/utils/currency";

type PitchCardStatus = Omit<PitchStatus, "SUSPENDED" | "DELETED" | "REJECTED">;

export interface PitchCardProps {
    id: string;
    name: string;
    street: string;
    area: string;
    city: string;
    country: string;
    status: PitchCardStatus;
    basePrice: number;
    layout: {
        grounds: GroundType[];
        combinations: CombinationType[];
    };
    schedule: {
        dayOfWeek: number;
        openTime: number;
        closeTime: number;
    }[];
    permissions: {
        manager: {
            user: {
                firstName: string;
                lastName: string;
            }
        }
    }[];
};

const isPitchOpen = (schedule: { dayOfWeek: number, openTime: number, closeTime: number }[]) => {
    const today = schedule[0];
    const tomorrow = schedule[1];

    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    // if it's still the same day
    if (currentDay === today.dayOfWeek) {
        return currentHour >= today.openTime && currentHour < (today.closeTime === 24 ? 25 : today.closeTime);
    }

    // if we've just rolled over past midnight, check tomorrow's schedule
    if (currentDay === tomorrow.dayOfWeek) {
        return currentHour >= tomorrow.openTime && currentHour < (tomorrow.closeTime === 24 ? 25 : tomorrow.closeTime);
    }

    return false;
};

const PitchCardStatusBadge = ({ status, schedule } : { status: PitchCardStatus, schedule: { dayOfWeek: number, openTime: number, closeTime: number }[] }) => {
    switch (status) {
        case "ARCHIVED":
            return <div className="text-[0.7rem] rounded-md border-[1px] border-gray-400 py-1.5 px-3 text-gray-800">Archived</div>
        case "LIVE":
            {
                const isOpen = isPitchOpen(schedule);

                if (isOpen) return <div className="text-[0.7rem] rounded-md border-[1px] border-gray-400 py-1.5 px-3 text-gray-800">Open</div>;
                return <div className="text-[0.7rem] rounded-md border-[1px] border-gray-400 py-1.5 px-3 text-gray-800">Closed</div>
            }
    }
}

export function PitchCard({ pitch } : { pitch: PitchCardProps }) { 
    const today = new Date();
    const activeSchedule = today.getDay() === pitch.schedule[0].dayOfWeek ? pitch.schedule[0] : pitch.schedule[1];

    return (
        <Link href={`/dashboard/pitch/${pitch.id}`} className="flex flex-col rounded-lg border-[1px] border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-center justify-between gap-x-16 p-6 border-b-[1px] border-gray-200">
                <div className="flex flex-col gap-y-0.5">
                    <span className="text-gray-500 text-[0.7rem]">{pitch.id}</span>
                    <h1 className="text-[1.1rem] font-medium">{pitch.name}</h1>
                    <span className="text-gray-500 text-[0.75rem]">{pitch.street}, {pitch.area}</span>
                </div>
                <PitchCardStatusBadge status={pitch.status} schedule={pitch.schedule}/>
            </div>
            <div className="p-6">
                <span className="text-[0.8125rem]">{pitch.layout.grounds.length > 1 ? "Multiground" : null} Sports Complex</span>
                <h1 className="text-lg font-medium">{pitch.name}</h1>
                <div className="flex flex-col gap-y-4.5 my-4">
                    <div className="flex flex-col gap-y-2">
                        <div className="flex items-center gap-x-5">
                            <span className="text-xs text-gray-500">Price</span>
                            <span className="font-medium text-[0.8rem]">{currencyFormat.format(pitch.basePrice)}/hr</span>
                        </div>
                        <div className="flex items-center gap-x-5">
                            <span className="text-xs text-gray-500">Schedule</span>
                            <span className="font-medium text-[0.8rem]">{formatHour(activeSchedule.openTime)} - {formatHour(activeSchedule.closeTime)}</span>
                        </div>
                        <div className="flex items-center gap-x-5">
                            <span className="text-xs text-gray-500">Location</span>
                            <span className="text-[0.8rem]">{pitch.street}, {pitch.area}, {pitch.city}, {pitch.country}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-y-2.5">
                        <span className="text-xs text-gray-500">Grounds</span>
                        <div className="flex items-center gap-x-1">
                            {
                                pitch.layout.grounds.map(ground => {
                                    return (
                                        <div key={ground.id} className="px-3 py-1 rounded-full border-[1px] border-blue-700 text-blue-700 text-[0.7rem]">
                                            {ground.name}
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                    <div className={`flex flex-col ${pitch.layout.combinations.length > 0 ? "gap-y-2.5" : "gap-y-1"}`}>
                        <span className="text-xs text-gray-500">Combinations</span>
                        <div className="flex items-center gap-x-1">
                            {
                                pitch.layout.combinations.length > 0 ?
                                pitch.layout.combinations.map(combination => {
                                    return (
                                        <div key={combination.id} className="px-3 py-1 rounded-full border-[1px] border-blue-700 text-blue-700 text-[0.7rem]">
                                            {combination.name}
                                        </div>
                                    )
                                }) :
                                <span className="text-[0.8rem]">No combinations created yet.</span>
                            }
                        </div>
                    </div>
                    <div className={`flex flex-col ${pitch.permissions.length > 0 ? "gap-y-2.5" : "gap-y-1"}`}>
                        <span className="text-xs text-gray-500">Managers</span>
                        <div className="flex items-center gap-x-1">
                            {
                                pitch.permissions.length > 0 ?
                                pitch.permissions.map((item, index) => {
                                    return (
                                        <div key={index} className="size-8 bg-black rounded-full text-white flex items-center justify-center" title={`${item.manager.user.firstName} ${item.manager.user.lastName}`}>
                                            <span>
                                                {item.manager.user.firstName[0].toUpperCase()}
                                            </span>
                                        </div>
                                    )
                                }) :
                                <span className="text-[0.8rem]">No managers added yet.</span>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
};