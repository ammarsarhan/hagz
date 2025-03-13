"use client"

import useAuthContext from '@/context/useAuthContext';
import { useEffect, useState } from 'react'

export default function DashboardReservationView ({params} : {params: Promise<{id: string}>}) {
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(true);
    const [reservationId, setReservationId] = useState<string | null>(null);

    const auth = useAuthContext();

    useEffect(() => {
        const fetchReservationData = async () => {
            const { id } = await params;
            setReservationId(id);
            setLoading(false);
        
            const request = await fetch(`/api/owner/reservation?id=${id}`, {
                method: "GET",
                headers: new Headers({
                    "Authorization": `Bearer ${auth.data.accessToken}`
                })
            })

            const response = await request.json();
            console.log(response);
        }

        fetchReservationData();
    }, [params])
    
    return (
        <div>
            {reservationId}
        </div>
    )
}