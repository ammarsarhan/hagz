"use client";

import Breadcrumbs from "@/components/ui/Breadcrumbs"
import Button from "@/components/ui/Button"
import useDashboardContext from "@/context/useDashboardContext";
import useAuthContext from "@/context/useAuthContext";
import Skeleton from "react-loading-skeleton";
import Link from "next/link"

import { useState, KeyboardEvent, ChangeEvent, useEffect, FormEvent } from "react";
import { today, getRecurringDates } from "@/utils/date";
import { PaymentMethodType } from "@/utils/types/payment";

import getCurrencyFormat from "@/utils/currency";
import { useRouter } from "next/navigation";
import { ReservationStatus } from "@/utils/types/reservation";
import Loading from "@/components/ui/Loading";

export default function DashboardReservationAdd () {
    const router = useRouter();

    const auth = useAuthContext();
    const dashboard = useDashboardContext();

    const handleWeekKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        const allowedKeys = ["Backspace", "ArrowLeft", "ArrowRight", "Delete"];
        const char = e.key;

        if (allowedKeys.includes(char)) {
            return;
        }

        if (!/^[2-8]$/.test(char) || e.currentTarget.value.length > 0) {
            e.preventDefault();
            return;
        }
    }

    const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        
        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }
        if (value.length > 8) {
            value = value.slice(0, 8) + '-' + value.slice(8);
        }
        
        e.target.value = value;
        setReserveePhone(value);
    }

    const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        const temp = new Date(e.target.value);

        if (temp < today) {
            e.preventDefault();
            setDate(today);
            return;
        }

        setDate(temp);
        setStartTime(new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), startTime.getHours(), 0, 0));
        setEndTime(new Date(temp.getFullYear(), temp.getMonth(), temp.getDate(), endTime.getHours(), 0, 0));
    }

    const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const hours = parseInt(e.target.value.split(":")[0]);
        const temp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, 0, 0);

        // if (temp < new Date()) {
        //     console.log("Invalid start input")
        //     console.log("Current: ", today.toLocaleDateString(), today.toLocaleTimeString())
        //     console.log("Comparator: ", temp.toLocaleDateString(), temp.toLocaleTimeString())
        //     e.preventDefault();
        //     return;
        // }
        
        setStartTime(temp);
    }
    
    const handleEndTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const hours = parseInt(e.target.value.split(":")[0]);
        const temp = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, 0, 0);

        // if (temp <= startTime) {
        //     e.preventDefault();
        //     console.log("Invalid end input")
        //     console.log("Current: ", today.toLocaleDateString(), today.toLocaleTimeString())
        //     console.log("Comparator: ", temp.toLocaleDateString(), temp.toLocaleTimeString())
        //     return;
        // }

        setEndTime(temp);
    }

    const handlePaymentMethodChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as PaymentMethodType
        setPaymentMethod(value);
    }

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        setLocaleLoading(true);

        console.log({
            reserveeName: `${reserveeTitle} ${reserveeFirstName} ${reserveeLastName}`,
            reserveePhone: reserveePhone,
            reserveeEmail: reserveeEmail,
            owner: auth.data.user?.id,
            pitch: dashboard.data.pitchOptions[dashboard.data.activePitchIndex].id,
            date: date,
            startTime: startTime,
            endTime: endTime,
            recurring: recurring,
            total: total,
            recurringDates: recurring ? getRecurringDates(date, weekCount) : [],
            paymentMethod: {

            },
            status: status
        })

        const createReservation = async () => {
            const request = await fetch ("/api/owner/reservation/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${auth.data.accessToken}`
                },
                body: JSON.stringify({
                    reserveeName: `${reserveeTitle} ${reserveeFirstName} ${reserveeLastName}`,
                    reserveePhone: reserveePhone,
                    reserveeEmail: reserveeEmail,
                    owner: auth.data.user?.id,
                    pitch: dashboard.data.pitchOptions[dashboard.data.activePitchIndex].id,
                    date: date,
                    startTime: startTime,
                    endTime: endTime,
                    recurring: recurring,
                    total: total,
                    recurringDates: recurring ? getRecurringDates(date, weekCount) : [],
                    paymentMethod: {

                    },
                    status: status
                })
            })

            const data = await request.json();
            
            if (request.status == 200) {
                router.push("/dashboard/reservations");
                return;
            }

            setLocaleLoading(false);
            console.log(data.message)
        }

        createReservation();
    }

    const loading = auth.data.loading || dashboard.data.loading;
    const [localeLoading, setLocaleLoading] = useState(false);

    const [reserveeTitle, setReserveeTitle] = useState("");
    const [reserveeFirstName, setReserveeFirstName] = useState("");
    const [reserveeLastName, setReserveeLastName] = useState("");
    const [reserveePhone, setReserveePhone] = useState("");
    const [reserveeEmail, setReserveeEmail] = useState("");

    const [status, setStatus] = useState<ReservationStatus>("Confirmed")

    const [filterBookings, setFilterBookings] = useState(false);
    const [recurring, setRecurring] = useState(false);
    const [weekCount, setWeekCount] = useState(2);
    
    const [date, setDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1, 0, 0));
    const [endTime, setEndTime] = useState(new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 2, 0, 0));
    
    const [base, setBase] = useState(0);
    const [service, setService] = useState(10);
    const [total, setTotal] = useState(0);

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("Card");

    useEffect(() => {
        if (!loading) {
            const price = dashboard.data.pitchOptions[dashboard.data.activePitchIndex].price;
            const duration = endTime.getHours() - startTime.getHours();

            setBase(price * duration);
            setService(10 * duration);
            setTotal((price * duration) + (10 * duration));
        }
    }, [dashboard.data.activePitchIndex, dashboard.data.pitchOptions, endTime, loading, startTime])

    useEffect(() => {
        const calculateTotal = () => {
            if (!loading) {
                const price = dashboard.data.pitchOptions[dashboard.data.activePitchIndex].price;
                const duration = endTime.getHours() - startTime.getHours();

                setBase(price * duration);
                setService(10 * duration);
                setTotal((price * duration) + (10 * duration));
            }
        }

        calculateTotal();
    }, [startTime, endTime, recurring, weekCount, loading, dashboard.data.pitchOptions, dashboard.data.activePitchIndex])

    return (
        <>
            {
                localeLoading &&
                <div className="fixed top-0 left-0 h-screen w-screen flex-center bg-gray-50">
                    <Loading/>
                </div>
            }
            <div className="flex flex-wrap gap-x-8 gap-y-2 items-center justify-between my-4">
                <Breadcrumbs labels={[{label: "Reservations", href: "/dashboard/reservations"}, {label: "Add", href: "/dashboard/reservation/add"}]}/>
                <Link href="/dashboard/reservations" className="text-xs sm:text-sm underline hover:text-gray-600 text-black transition-colors">Return to reservations</Link>
            </div>
            <div className="flex flex-col gap-y-1">
                <h1 className="text-xl font-medium">Add Reservation</h1>
                <p className="text-dark-gray text-sm">Manually create and manage a new reservation for a user.</p>
            </div>
            <form action="" className="flex flex-col gap-y-2 my-4" onSubmit={handleFormSubmit}>
                <div>
                    <span className="block mt-2 mb-4 text-sm">Reservee Details</span>
                    <div className="flex flex-col gap-y-4 pb-8 border-b-[1px]">
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Title</span>
                                <input type="text" placeholder="Title (optional)" className="border-[1px] rounded-md py-2 px-3" value={reserveeTitle} onChange={e => setReserveeTitle(e.target.value)}/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">First Name</span>
                                <input type="text" required placeholder="First Name" className="border-[1px] rounded-md p-2 px-3" value={reserveeFirstName} onChange={e => setReserveeFirstName(e.target.value)}/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Last Name</span>
                                <input type="text" required placeholder="Last Name" className="border-[1px] rounded-md p-2 px-3" value={reserveeLastName} onChange={e => setReserveeLastName(e.target.value)}/>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Phone Number</span>
                                <input type="text" placeholder="Number" maxLength={13} required className="border-[1px] rounded-md p-2 px-3" value={reserveePhone} onChange={handlePhoneChange}/>
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Email Address</span>
                                <input type="email" placeholder="Email (optional)" className="border-[1px] rounded-md p-2 px-3" value={reserveeEmail} onChange={e => setReserveeEmail(e.target.value)}/>
                            </div>
                        </div>
                    </div>
                    <span className="block mt-6 mb-4 text-sm">Reservation Details</span>
                    <div className="flex flex-col gap-y-4 pb-8 border-b-[1px]">
                        <div className="flex items-center gap-x-4">
                            <div className="flex items-center gap-x-2">
                                <input type="checkbox" checked={recurring} onChange={() => setRecurring(!recurring)}/>
                                <span className="text-sm" onClick={() => setRecurring(!recurring)}>Recurring?</span>
                            </div>
                            <div className="flex items-center gap-x-2">
                                <input type="checkbox" checked={filterBookings} onChange={() => setFilterBookings(!filterBookings)}/>
                                <span className="text-sm" onClick={() => setFilterBookings(!filterBookings)}>Filter Bookings?</span>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm sm:w-1/3">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Reservation Status</span>
                                <select value={status} onChange={e => setStatus(e.target.value as ReservationStatus)} className="border-b-[1px] p-2">
                                    <option value="Confirmed">Confirmed</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm sm:w-1/3">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Date</span>
                                <input 
                                    type="date" 
                                    placeholder="Date" 
                                    className="border-b-[1px] p-2 px-3"
                                    onChange={handleDateChange}
                                    value={date.toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Start Time</span>
                                <input 
                                    type="time" 
                                    placeholder="Start" 
                                    step="3600000" 
                                    className="border-b-[1px] p-2 px-3"
                                    onChange={handleStartTimeChange}
                                    value={startTime.toTimeString().split(' ')[0]}
                                />
                            </div>
                            <span className="hidden sm:block">to</span>
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">End Time</span>
                                <input 
                                    type="time"
                                    placeholder="End" 
                                    step="3600000" 
                                    className="border-b-[1px] p-2 px-3"
                                    onChange={handleEndTimeChange}
                                    value={endTime.toTimeString().split(' ')[0]}
                                />
                            </div>
                        </div>
                        {
                            recurring &&
                            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm">
                                <div className="flex w-full items-center gap-x-2">
                                    <span className="text-dark-gray flex-1 basis-[75%]">Number of Weeks</span>
                                    <input type="number" min={2} max={8} value={weekCount} onChange={(e) => setWeekCount(parseInt(e.target.value))} pattern="[2-8]" placeholder="Weeks" className="border-[1px] rounded-md p-2 px-3 flex-1 basis-[25%]" onKeyDown={(e) => handleWeekKeyPress(e)}/>
                                </div>
                                {
                                    !isNaN(weekCount) &&
                                    <div className="flex flex-col w-full">
                                        <span className="text-dark-gray">Subsequent Reservations</span>
                                        <ol>
                                            {
                                                Array.from({length: weekCount}).map((_, i) => {
                                                    return (
                                                        <li key={i} className={`flex items-center gap-x-3 ${i == 0 ? "mt-4 mb-4" : "my-4"} w-full justify-between sm:justify-normal`}>
                                                            <span>{i + 1}- {getRecurringDates(date, weekCount)[i].toLocaleDateString("en-uk", {weekday: "long", month: "long", day: "numeric", year: "numeric"})}</span>
                                                            {
                                                                i === 0 &&
                                                                <div className="py-1 px-3 mx-2 text-xs rounded-lg border-[1px] w-fit">Original</div>
                                                            }
                                                        </li>
                                                    )
                                                })
                                            }
                                        </ol>
                                    </div>
                                }
                            </div>
                        }
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm sm:w-1/2">
                            <div className="flex flex-col flex-1 gap-y-2">
                                {
                                    loading ?
                                    <>
                                        <Skeleton height={20} width={40}/>
                                        <Skeleton height={35}/>
                                    </> :
                                    <>
                                        <span className="text-dark-gray">Pitch ID</span>
                                        <input type="text" readOnly value={dashboard.data.pitchOptions[dashboard.data.activePitchIndex].id} className="border-[1px] rounded-md py-2 px-3"/>
                                    </>
                                }
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm sm:w-1/2">
                            <div className="flex flex-col flex-1 gap-y-2">
                                {
                                    loading ?
                                    <>
                                        <Skeleton height={20} width={40}/>
                                        <Skeleton height={35}/>
                                    </> :
                                    <>
                                        <span className="text-dark-gray">Owner ID</span>
                                        <input type="text" readOnly value={auth.data.user?.id} className="border-[1px] rounded-md py-2 px-3"/>
                                    </>
                                }
                            </div>
                        </div>
                        <div className="flex gap-x-8 gap-y-4 text-sm">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Additional Notes</span>
                                <textarea placeholder="Stick to 100 words or less..." className="border-[1px] rounded-md py-2 px-3 h-[30vh] resize-none"/>
                            </div>
                        </div>
                    </div>
                    <span className="block mt-6 mb-4 text-sm">Payment Details</span>
                    <div className="flex flex-col gap-y-4 pb-6">
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm">
                            <div className="flex flex-col flex-1 gap-y-2">
                                {
                                    loading ?
                                    <>
                                        <Skeleton height={20} width={50}/>
                                        <Skeleton height={25}/>
                                    </> :
                                    <>
                                        <span className="text-dark-gray">Base Price</span>
                                        <span>{isNaN(total) ? "N/A" : getCurrencyFormat(base)} {}</span>
                                    </>
                                }
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                {
                                    loading ?
                                    <>
                                        <Skeleton height={20} width={50}/>
                                        <Skeleton height={25}/>
                                    </> :
                                    <>
                                        <span className="text-dark-gray">Service Fee</span>
                                        <span>{isNaN(total) ? "N/A" : getCurrencyFormat(service)} {}</span>
                                    </>
                                }
                            </div>
                            <div className="flex flex-col flex-1 gap-y-2">
                                {
                                    loading ?
                                    <>
                                        <Skeleton height={20} width={50}/>
                                        <Skeleton height={25}/>
                                    </> :
                                    <>
                                        <span className="text-dark-gray">Total Due</span>
                                        <span className="font-semibold">{isNaN(total) ? "N/A" : getCurrencyFormat(total)} {}</span>
                                    </>
                                }
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 text-sm sm:w-1/2">
                            <div className="flex flex-col flex-1 gap-y-2">
                                <span className="text-dark-gray">Payment Method</span>
                                <select className="border-b-[1px] p-2" value={paymentMethod} onChange={handlePaymentMethodChange}>
                                    <option value="Card">Credit Card</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Wallet">Mobile Wallet</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 flex justify-end w-full">
                        <Button type="submit" variant="color" className="flex items-center gap-x-2">Proceed To Checkout</Button>
                    </div>
                </div>
            </form>
        </>
    )
}