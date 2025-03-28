"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AmenityType } from "@/context/filter";
import Button from "@/components/button";
import getCurrencyString from "@/utils/currency";
import { getDisplaySize, getDisplayStatus, getDisplaySurface } from "@/utils/map";
import { Calendar, ChevronRight, X } from "lucide-react";
import { InputGroup, InputGroupContainer } from "@/components/input";
import { convertHourFormat, getHourDifference, isWithinRange, toUTCDate } from "@/utils/date";

interface PitchData {
    amenities: AmenityType[],
    coordinates: {
        type: "Point",
        coordinates: [number, number]
    },
    description: string,
    grounds: number,
    id: string,
    images: string[],
    location: {
        city: string,
        street: string,
        country: string,
        district: string,
        governorate: string
        externalLink?: string
    },
    name: string,
    minimumSession: number,
    maximumSession: number,
    priceRange: [number, number],
    openFrom: string,
    openTo: string,
    updatedAt: string
}

interface GroundData {
    createdAt: string,
    id: string,
    images: string[],
    index: number,
    pitchId: string,
    price: number,
    size: "FIVE_A_SIDE" | "SEVEN_A_SIDE" | "ELEVEN_A_SIDE",
    status: "ACTIVE" | "MAINTENANCE" | "CLOSED",
    surface: "ARTIFICIAL" | "NATURAL",
    updatedAt: string
}

const Availability = ({ onClose, min, max, openingTime, closingTime } : { onClose : () => void, min: number, max: number, openingTime: string, closingTime: string }) => {
    const now = new Date();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const setErrorWithTimeout = (message: string) => {
        setError(message);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        };
    
        timeoutRef.current = setTimeout(() => {
            setError(null);
        }, 3000);
    }

    const [targetDate, setTargetDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const handleSetTargetDate = (e: ChangeEvent<HTMLInputElement>) => {
        setTargetDate(e.target.value);
    }
    
    const handleSetStartTime = (e: ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        const hour = time.split(":")[0];
        const parsed = `${hour}:00`;
        
        setStartTime(parsed);
    }

    const handleSetEndTime = (e: ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        const hour = time.split(":")[0];
        const parsed = `${hour}:00`;
        
        setEndTime(parsed);
    }

    const fetchReservations = useCallback(async (startDate: Date, endDate: Date) => {
        setLoading(true);
        console.log(startDate, endDate);
        setLoading(false);
    }, []);

    const checkAvailability = () => {
        if (targetDate == "") {
            setErrorWithTimeout("Please select a day to check reservations.")
            return;
        }

        if (targetDate != "" && startTime == "" || targetDate != "" && endTime == "") {
            setErrorWithTimeout("You may not pick a date without selecting both start and end time.");
            return;
        }

        if (targetDate == "" && startTime != "" || targetDate == "" && endTime != "") {
            setErrorWithTimeout("You may not pick a start or end time without selecting a date.");
            return;
        }

        let startDate = toUTCDate(now.toISOString(), "00:00");
        let endDate = toUTCDate(now.toISOString(), "23:59");

        if (startTime != "" || endTime != "") {
            startDate = toUTCDate(targetDate, startTime);
            endDate = toUTCDate(targetDate, endTime);
        };

        if (startDate <= now || endDate <= now) {
            setErrorWithTimeout("Both start and end time must be upcoming.");
            return;
        }

        if (startDate >= endDate) {
            setErrorWithTimeout("Start time may not be after the end time.");
            return;
        }

        if (!isWithinRange(startTime, endTime, openingTime, closingTime)) {
            setErrorWithTimeout("Start time and end time must be within the open pitch hours.");
            return;
        }

        if (getHourDifference(startDate, endDate) < min || getHourDifference(startDate, endDate) > max) {
            setErrorWithTimeout(`Difference may only be between ${min} to ${max} hours.`);
            return;
        }

        fetchReservations(startDate, endDate);
    }

    return (
        <div className="flex-center fixed top-0 left-0 z-50 h-screen w-screen bg-black/30">
            <div className="p-6 bg-white rounded-md min-w-96 w-2xl mx-4">
                <div className="flex items-center justify-between pb-3">
                    <span className="flex items-center text-sm gap-x-2"><Calendar className="w-4 h-4 text-gray-500"/> Check Availability</span>
                    <button onClick={onClose}><X className="w-4 h-4"/></button>
                </div>
                <div>
                    <p className="text-sm text-gray-500 w-full sm:w-3/4 mt-2 mb-4">Select a specified time range between 1 to 6 hours to check if reservations are available.</p>
                    <div className="flex flex-col gap-y-4 mt-4">
                        <span className="text-sm text-red-600">{error}</span>
                        <InputGroup label={"Day"} type="date" placeholder={"Select a day"} value={targetDate} onChange={handleSetTargetDate}/>
                        <InputGroupContainer>
                            <InputGroup label={"Start Time"} type="time" placeholder={"Select a start time"} value={startTime} onChange={handleSetStartTime}/>
                            <InputGroup label={"End Time"} type="time" placeholder={"Select an end time"} value={endTime} onChange={handleSetEndTime}/>
                        </InputGroupContainer>
                    </div>
                    <div className="flex justify-end">
                        <Button className="text-xs py-3 mt-8" variant={loading ? "disabled" : "primary"} onClick={checkAvailability} disabled={loading}>Check availability</Button>
                    </div>
                </div>
            </div>
        </div>
    )
};

export default function Pitch () {
    const { id } = useParams();
    
    const [loading, setLoading] = useState(true);
    const [index, setIndex] = useState(0);
    const [pitch, setPitch] = useState<PitchData | null>(null);
    const [grounds, setGrounds] = useState<GroundData[]>([]);

    const [availabilityOpen, setAvailabilityOpen] = useState(false);

    const fetchPitch = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`http://localhost:3000/api/pitch/${id}`);
        const result = await res.json();

        if (!result.success) {
            console.log(result.message);
            return;
        }

        setPitch(result.data);
        setLoading(false);
    }, [id])

    const fetchGrounds = useCallback(async () => {
        setLoading(true);
        const res = await fetch(`http://localhost:3000/api/pitch/${id}/grounds`);
        const result = await res.json();

        if (!result.success) {
            console.log(result.message);
            return;
        }

        setGrounds(result.data);
        setLoading(false);
    }, [id])

    useEffect(() => {
        fetchPitch();
        fetchGrounds();
    }, [fetchPitch, fetchGrounds]);

    return (
        !loading && pitch && grounds.length > 0 &&
        <>
            { 
                availabilityOpen && 
                <Availability 
                    onClose={() => setAvailabilityOpen(false)} 
                    min={pitch.minimumSession} 
                    max={pitch.maximumSession}
                    openingTime={pitch.openFrom}
                    closingTime={pitch.openTo}
                /> 
            }
            <div className="w-full text-sm px-4 flex flex-wrap items-center gap-x-2 mb-4">
                <span className="text-gray-500">Pitch</span>
                <ChevronRight className="w-3 h-3 text-gray-500"/>
                <span>{pitch.name}</span>
                <ChevronRight className="w-3 h-3 text-gray-500"/>
                <span className="text-gray-500">Ground</span>
                <ChevronRight className="w-3 h-3 text-gray-500"/>
                <span>Ground {index + 1}</span>
            </div>
            <div className="lg:grid grid-cols-2 h-full">
                <div className="flex flex-col justify-between">
                    <div className="flex flex-col gap-y-2 px-4 pb-6">
                        <div className="flex-col-reverse sm:flex-row flex flex-wrap items-start justify-between gap-x-16 gap-y-3 sm:gap-y-2 mb-2">
                            <h1 className="text-3xl leading-10">{pitch.name} <br/> Ground {index + 1}</h1>
                            <div className="text-xs border-[1px] rounded-md px-3 py-1">{pitch.grounds > 1 ? `${pitch.grounds} Grounds` : `${pitch.grounds} Ground`}</div>
                        </div>
                        <span>{getCurrencyString(grounds[index].price)}/hr</span>
                        <p className="text-sm my-2">{pitch.description}</p>
                        <div className="mt-2">
                            <span className="text-sm text-gray-500 block mb-3">Select Ground:</span>
                            <div className="flex flex-wrap gap-x-10 gap-y-4 items-center">
                                {
                                    grounds.map((ground, i) => {
                                        const selected = i === index;

                                        return (
                                            <button key={i} className={`px-3 py-2 rounded-md border-[1px] relative flex flex-col text-sm ${selected ? "bg-gray-100" : ""}`} onClick={() => setIndex(i)}>
                                                <span className={`w-5 h-5 text-white absolute -top-2 -right-2 rounded-full text-xs flex-center ${selected ? "bg-gray-600" : "bg-black"}`}>{i + 1}</span>
                                                <span className="text-left">{getCurrencyString(ground.price)}</span>
                                                <span className="text-left">{getDisplaySize(ground.size)}</span>
                                                <span>{getDisplaySurface(ground.surface)}</span>
                                            </button>
                                        )
                                    })
                                }
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 mt-4">
                            <button className="text-sm text-blue-800 hover:underline" onClick={() => setAvailabilityOpen(true)}>Check availability</button>
                            <Button className="text-xs py-3">Reserve Now</Button>
                        </div>
                        <div className="mt-4">
                            <span className="text-sm text-gray-500">Ground Details:</span>
                            <div className="flex flex-col gap-y-2">
                                <div className="flex flex-wrap gap-x-14 gap-y-4 mt-2 text-sm">
                                    <div>
                                        <span className="text-sm text-gray-500">Status</span>
                                        <span className="block">{getDisplayStatus(grounds[index].status)}</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">Ground Size</span>
                                        <span className="block">{getDisplaySize(grounds[index].size)}</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">Ground Surface</span>
                                        <span className="block">{getDisplaySurface(grounds[index].surface)}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-x-14 gap-y-4 mt-2 text-sm">
                                    <div>
                                        <span className="text-sm text-gray-500">Amenities</span>
                                        <p>
                                            {
                                                pitch.amenities.length > 0 ?
                                                pitch.amenities.map((amenity, i) => <span key={index}>{`${amenity}${i < pitch.amenities.length - 1 ? ", " : ""}`}</span>) :
                                                "None"
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-x-14 gap-y-4 mt-2 text-sm">
                                    <div>
                                        <span className="text-sm text-gray-500">Reservation Range</span>
                                        <span className="block">Between {pitch.minimumSession}-{pitch.maximumSession} hrs</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">Working Hours</span>
                                        <span className="block">{convertHourFormat(pitch.openFrom)} to {convertHourFormat(pitch.openTo)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col">
                    <div className="w-full h-3/5 bg-gray-300">
                    </div>
                    <div className="flex h-2/5">
                        <div className="w-1/3 bg-gray-300"></div>
                        <div className="w-1/3 bg-gray-300"></div>
                        <div className="w-1/3 bg-gray-300"></div>
                    </div>
                </div>
            </div>
        </>
    )
}