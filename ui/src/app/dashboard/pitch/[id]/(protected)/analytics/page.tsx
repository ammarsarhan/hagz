"use client";

import { useQuery } from "@tanstack/react-query"
import { addWeeks, format, subWeeks } from "date-fns";
import { useParams } from "next/navigation"
import { fetchAnalytics } from "@/app/utils/api/client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyFormat } from "@/app/utils/currency";
import { getChartColor } from "@/app/utils/color";

interface GroundType { id: string, name: string };

export default function Analytics() {
    const { id } = useParams<{ id: string }>();
    const now = new Date();

    const startDate = subWeeks(now, 2);
    const endDate = addWeeks(now, 2);

    const { data } = useQuery({
        queryKey: ["dashboard", "pitch", id, "analytics"],
        queryFn: () => fetchAnalytics(id, startDate, endDate)
    });

    if (!data) return;

    console.log(data);

    const colors = data.analytics.grounds.map((_: string, index: number) => getChartColor(index));

    return (
        <div className="px-6 my-6">
            <div className="flex mb-8">
                <div className="flex-1 p-4 border-[1px] rounded-l-md border-gray-200 flex flex-col gap-y-1">
                    <h2 className="text-[0.825rem]">Total Revenue</h2>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-y-0.25">
                            <div className="flex items-center gap-x-1.75">
                                <span className="font-medium">{currencyFormat.format(data.analytics.totalRevenue.current)}</span>
                            </div>
                            <span className="text-gray-500 text-xs">Within {format(startDate, "dd MMM")} - {format(endDate, "dd MMM")}</span>
                        </div>
                        <div className="w-24 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.analytics.totalRevenue.trend.map((value: number, index: number) => ({ value, index }))}>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop 
                                            offset="0%" 
                                            stopColor={data.analytics.totalRevenue.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0.4}
                                        />
                                        <stop 
                                            offset="100%" 
                                            stopColor={data.analytics.totalRevenue.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                    <Area 
                                        type="monotone" 
                                        dataKey="value"
                                        stroke={data.analytics.totalRevenue.direction === 'UP' ? '#0000ff' : '#ef4444'}
                                        strokeWidth={1.5}
                                        fill="url(#colorRevenue)"
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-4 border-y-[1px] border-r-[1px] border-gray-200">
                    <h2 className="text-[0.825rem]">Total Bookings</h2>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-y-0.25">
                            <div className="flex items-center gap-x-1.75">
                                <span className="font-medium">{data.analytics.totalBookings.current} Bookings</span>
                            </div>
                            <span className="text-gray-500 text-xs">Within {format(startDate, "dd MMM")} - {format(endDate, "dd MMM")}</span>
                        </div>
                        <div className="w-24 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.analytics.totalBookings.trend.map((value: number, index: number) => ({ value, index }))}>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop 
                                            offset="0%" 
                                            stopColor={data.analytics.totalBookings.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0.4}
                                        />
                                        <stop 
                                            offset="100%" 
                                            stopColor={data.analytics.totalBookings.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                    <Area 
                                        type="monotone" 
                                        dataKey="value"
                                        stroke={data.analytics.totalBookings.direction === 'UP' ? '#0000ff' : '#ef4444'}
                                        strokeWidth={1.5}
                                        fill="url(#colorRevenue)"
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-4 border-y-[1px] border-r-[1px] border-gray-200">
                    <h2 className="text-[0.825rem]">Occupancy Rate</h2>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-y-0.25">
                            <div className="flex items-center gap-x-1.75">
                                <span className="font-medium">{data.analytics.occupancyRate.current.toFixed(2)}%</span>
                            </div>
                            <span className="text-gray-500 text-xs">Within {format(startDate, "dd MMM")} - {format(endDate, "dd MMM")}</span>
                        </div>
                        <div className="w-24 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.analytics.occupancyRate.trend.map((value: number, index: number) => ({ value, index }))}>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop 
                                            offset="0%" 
                                            stopColor={data.analytics.occupancyRate.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0.4}
                                        />
                                        <stop 
                                            offset="100%" 
                                            stopColor={data.analytics.occupancyRate.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                    <Area 
                                        type="monotone" 
                                        dataKey="value"
                                        stroke={data.analytics.occupancyRate.direction === 'UP' ? '#0000ff' : '#ef4444'}
                                        strokeWidth={1.5}
                                        fill="url(#colorRevenue)"
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-4 border-y-[1px] border-r-[1px] rounded-r-md border-gray-200">
                    <h2 className="text-[0.825rem]">Total Customers</h2>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col gap-y-0.25">
                            <div className="flex items-center gap-x-1.75">
                                <span className="font-medium">{data.analytics.totalCustomers.current} Customers</span>
                            </div>
                            <span className="text-gray-500 text-xs">Within {format(startDate, "dd MMM")} - {format(endDate, "dd MMM")}</span>
                        </div>
                        <div className="w-24 h-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.analytics.totalCustomers.trend.map((value: number, index: number) => ({ value, index }))}>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop 
                                            offset="0%" 
                                            stopColor={data.analytics.totalCustomers.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0.4}
                                        />
                                        <stop 
                                            offset="100%" 
                                            stopColor={data.analytics.totalCustomers.direction === 'UP' ? '#0000ff' : '#ef4444'} 
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                    <Area 
                                        type="monotone" 
                                        dataKey="value"
                                        stroke={data.analytics.totalCustomers.direction === 'UP' ? '#0000ff' : '#ef4444'}
                                        strokeWidth={1.5}
                                        fill="url(#colorRevenue)"
                                        dot={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-y-0.2">
                <h1 className="text-[0.9rem] font-medium">Revenue Per Ground</h1>
                <p className="text-gray-500 text-[0.8rem]">Track your revenue classified by grounds and filtered by time.</p>
            </div>
            <ResponsiveContainer className="mt-6 mb-8" width="100%" height={350}>
                <LineChart
                    data={data.analytics.revenueByGround}
                >
                    <defs>
                        {
                            data.analytics.grounds.map((ground: GroundType, index: number) => (
                                <linearGradient 
                                    key={`gradient-${ground.id}`}
                                    id={`gradient-${ground.id}`} 
                                    x1="0" 
                                    y1="0" 
                                    x2="0" 
                                    y2="1"
                                >
                                    <stop 
                                        offset="0%" 
                                        stopColor={colors[index]} 
                                        stopOpacity={0.3}
                                    />
                                    <stop 
                                        offset="95%" 
                                        stopColor={colors[index]} 
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            ))
                        }
                    </defs>
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={(value: Date) => format(value, "dd")}
                        interval={1}
                        tickMargin={10}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 13 }} 
                        padding={{ right: 20 }}
                    />
                    <CartesianGrid strokeDasharray="3 3" />
                    <YAxis 
                        tickFormatter={(value: number) => currencyFormat.format(value)}
                        domain={[0, 'auto']}
                        tickMargin={10}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 13 }} 
                        width={100}
                    />
                    <Tooltip formatter={(value, name) => [`${currencyFormat.format(value as number)}`, name]}/>
                    <Legend wrapperStyle={{ paddingTop: "1rem" }}/>
                    {
                        data.analytics.grounds.map((ground: GroundType, index: number) => (
                            <Line 
                                key={ground.id}
                                type="monotone" 
                                dataKey={ground.id}
                                name={ground.name}
                                strokeWidth={1.5}
                                dot={false}
                                stroke={colors[index]}
                            />
                        ))
                    }
                </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-x-6">
                <div className="w-1/3">
                    <div className="flex flex-col gap-y-0.5">
                        <h2 className="font-medium text-[0.9rem]">Booking Distribution</h2>
                        <p className="text-gray-500 text-[0.8rem]">Compare the percentage of guest to user bookings, including recurring customers.</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={data.analytics.bookingDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                                outerRadius={100}
                                dataKey="value"
                            >
                                {
                                    data.analytics.bookingDistribution.map((_: string, index: number) => (
                                        <Cell key={index} fill={colors[index]} />
                                    ))
                                }
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-2/3">
                    <div className="flex flex-col gap-y-0.5">
                        <h2 className="font-medium text-[0.9rem]">Show Up Rate</h2>
                        <p className="text-gray-500 text-[0.8rem]">Percentages of bookings that complete successfully, are cancelled before or after the cancellation deadline, or are a no-show.</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300} className="my-6">
                        <BarChart data={[
                            { name: 'Completed', value: data.analytics.totalBookings.current - data.analytics.cancellationRate.current - data.analytics.noShowRate.current },
                            { name: 'Cancelled', value: data.analytics.cancellationRate.current },
                            { name: 'No Show', value: data.analytics.noShowRate.current }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name"/>
                            <YAxis width={40} padding={{ top: 10, bottom: 10 }}/>
                            <Bar dataKey="value" fill={getChartColor(1)} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
};
