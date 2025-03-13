"use client";

import { useEffect, useState } from "react";
import { today, getMonthDays } from "@/utils/date";

import UtilityBar from "@/components/dashboard/UtilityBar";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import ViewSwitch from "@/components/ui/ViewSwitch";

import DailyView from "@/components/dashboard/DailyView";
import MonthlyView from "@/components/dashboard/MonthlyView";
import MonthlyBar from "@/components/dashboard/MonthlyBar";
import ReservationTable from "@/components/dashboard/ReservationTable";
import useReservationContext from "@/context/useReservationContext";
import Skeleton from "react-loading-skeleton";

export default function Reservations () {
    const context = useReservationContext();
    const loading = context.data.loading;
    const activeDate = context.data.activeDate;

    const handleDayClicked = (date: Date) => {
        context.actions.setActiveDate(date);
        context.actions.setCurrentView("List");
    }

    return (
        <>
            {
                loading ?
                <Skeleton height={20} width={60} className="mt-4"/> :
                <Breadcrumbs labels={[{label: "Reservations", href: "/dashboard/reservations"}]} className="mt-4"/>
            }
            <div className='flex flex-col pt-4'>
                {
                    loading ?
                    <Skeleton height={30} width={100} className="mb-3"/> :
                    <span className='font-semibold text-xl block'>All</span>
                }
            </div>
            <ViewSwitch/>
            {
                context.data.currentView == "List" &&
                <>
                    <UtilityBar date={activeDate} color="slate"/>
                    <MonthlyBar days={getMonthDays(activeDate)}/>
                    <ReservationTable reservations={context.data.reservations}/>
                </>
            }
            {
                context.data.currentView == "Calendar" &&
                <>
                    <UtilityBar date={activeDate} color="slate"/>
                    <MonthlyView date={activeDate} reservations={[]} color="blue" onChange={handleDayClicked}/>
                </>
            }
        </>
    )
}