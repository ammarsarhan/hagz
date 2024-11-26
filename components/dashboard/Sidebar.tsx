"use client";

import { Calendar, Wallet, Settings } from "lucide-react";
import useAuthContext from "@/context/useAuthContext";
import NavLink from "@/components/ui/NavLink";
import Selector from "@/components/dashboard/Selector";
import Profile from "@/components/dashboard/Profile";

export default function Sidebar () {
    const context = useAuthContext();

    if (context.data.user) {
        return (
            <aside className="flex-col h-screen p-6 border-r-[1px] bg-gray-100 w-[22rem] hidden lg:flex fixed lg:static">
                <div className='flex items-center mt-2 mb-4'>
                    <NavLink href="/"><span className='text-lg font-semibold text-primary-green'>حجز</span></NavLink>
                </div>
                <Selector value="El Nasr Football Club" description="Alexandria, Egypt" icon={<div className="bg-primary-green w-full h-full rounded-sm"></div>}/>
                <div className="overflow-y-scroll">
                    <div className="flex flex-col gap-y-6 my-6 text-sm">
                        <div className="border-b-[1px]">
                            <span className="flex items-center gap-x-2"><Calendar className="w-4 h-4"/>Reservations</span>
                            <ul className="flex flex-col gap-4 text-dark-gray py-4">
                                <li><NavLink href="/dashboard/reservations" className="sidebar-link">All</NavLink></li>
                                <li><NavLink href="/dashboard/reservations/scheduled" className="sidebar-link">Scheduled</NavLink></li>
                                <li><NavLink href="/dashboard/reservations/done" className="sidebar-link">Done</NavLink></li>
                            </ul>
                        </div>
                        <div className="border-b-[1px]">
                            <span className="flex items-center gap-x-2"><Wallet className="w-4 h-4"/>Sales</span>
                            <ul className="flex flex-col gap-4 text-dark-gray py-4">
                                <li><NavLink href="/dashboard/sales" className="sidebar-link">Tracker</NavLink></li>
                                <li><NavLink href="/dashboard/sales/pricing" className="sidebar-link">Pricing Schema</NavLink></li>
                                <li><NavLink href="/dashboard/sales/billing" className="sidebar-link">Billing</NavLink></li>
                            </ul>
                        </div>
                        <div>
                            <span className="flex items-center gap-x-2"><Settings className="w-4 h-4"/>Settings</span>
                            <ul className="flex flex-col gap-4 text-dark-gray py-4">
                                <li><NavLink href="/dashboard/settings/details" className="sidebar-link">Pitch Details</NavLink></li>
                                <li><NavLink href="/dashboard/settings/notifications" className="sidebar-link">Notifications</NavLink></li>
                                <li><NavLink href="/dashboard/settings/security" className="sidebar-link">Privacy & Security</NavLink></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="mt-auto">
                    <Profile email={context.data.user.email}/>
                </div>
            </aside>
        )
    }
}