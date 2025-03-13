import { useContext, createContext, ReactNode, useState, useEffect } from "react";
import useAuthContext from "@/context/useAuthContext";

import Reservation from "@/utils/types/reservation";
import useDashboardContext from "./useDashboardContext";
import { today } from "@/utils/date";

interface ReservationContextDataType {
    reservations: Reservation[],
    currentView: "List" | "Calendar",
    activeDate: Date,
    loading: boolean,
    tableLoading: boolean
}

interface ReservationContextActionsType {
    setReservations: (reservations: Reservation[]) => void,
    setCurrentView: (view: "List" | "Calendar") => void,
    setActiveDate: (date: Date) => void,
    setLoading: (loading: boolean) => void,
    setTableLoading: (loading: boolean) => void,
    fetchReservationsByDate: (date: Date) => void
}

interface ReservationContextType {
    data: ReservationContextDataType,
    actions: ReservationContextActionsType,
}

export const ReservationContext = createContext<ReservationContextType | undefined>(undefined);

export default function useReservationContext() {
    const context = useContext(ReservationContext);

    if (context === undefined) {
        throw new Error("useReservationContext must be initialized with a ReservationContext");
    }

    return context;
}

export function ReservationContextProvider({children}: {children: ReactNode}) {
    const auth = useAuthContext();
    const dashboard = useDashboardContext();

    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [currentView, setCurrentView] = useState<"List" | "Calendar">("List");
    const [activeDate, setActiveDate] = useState<Date>(today);

    const [tableLoading, setTableLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const fetchReservationsByDate = async (date: Date) => {
        setTableLoading(true);

        const id = dashboard.data.pitchOptions[dashboard.data.activePitchIndex].id;

        const from = new Date(date.setHours(0, 0, 0, 0)).toLocaleString();
        const to = new Date(date.setHours(23, 59, 59, 999)).toLocaleString();

        const request = await fetch(`/api/owner/reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
            method: 'GET',
            headers: new Headers({
                "Authorization" : `Bearer ${auth.data.accessToken}`,
                "Pitch" : id
            })
        })

        const data = await request.json();
        setReservations(data.reservations);

        setLoading(false);
        setTableLoading(false);
    }

    useEffect(() => {
        if (!dashboard.data.loading) {
            fetchReservationsByDate(activeDate);
        }
    }, [activeDate])

    useEffect(() => {
        const fetchInitialReservations = async () => {
            setLoading(true);

            const id = dashboard.data.pitchOptions[dashboard.data.activePitchIndex].id;
    
            const from = new Date(activeDate.setHours(0, 0, 0, 0)).toLocaleString();
            const to = new Date(activeDate.setHours(23, 59, 59, 999)).toLocaleString();

            const request = await fetch(`/api/owner/reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
                method: 'GET',
                headers: new Headers({
                    "Authorization" : `Bearer ${auth.data.accessToken}`,
                    "Pitch" : id
                })
            })
    
            const data = await request.json();
            setReservations(data.reservations);
    
            setLoading(false);
            setTableLoading(false);
        }

        if (!dashboard.data.loading) {
            fetchInitialReservations();
        }
    }, [dashboard.data.loading])

    return (
        <ReservationContext.Provider value={{
            data: {
                currentView,
                activeDate,
                reservations,
                loading,
                tableLoading
            }, 
            actions: {
                setCurrentView,
                setActiveDate,
                setReservations,
                setLoading,
                setTableLoading,
                fetchReservationsByDate
            }
        }}>
            {children}
        </ReservationContext.Provider>
    )
}