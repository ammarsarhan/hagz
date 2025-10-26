"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import ErrorView from "@/app/components/base/Error";
import Pending from "@/app/invitation/states/Pending";
import { fetchInvitation } from "@/app/utils/api/client";
import Accepted from "./states/Accepted";

export default function Wrapper({ token } : { token: string }) {
    const queryClient = useQueryClient();

    const { data, isError, error } = useQuery({
        queryKey: ["invitation", token],
        queryFn: () => fetchInvitation(token),
        initialData: () => queryClient.getQueryData(["invitation", token])
    });

    if (isError || !data) {
        return (
            <ErrorView 
                title="An error has occurred while fetching invitation." 
                message={error?.message || "An unknown error has occurred. Please try again later."}
            />
        )
    };

    console.log(data);

    switch (data.status) {
        case "PENDING":
            {
                return <Pending data={data}/>
            }
        case "ACCEPTED":
            {
                return <Accepted data={data}/>
            }
    };
};
