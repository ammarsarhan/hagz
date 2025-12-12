import { differenceInHours, eachDayOfInterval, format, subDays } from "date-fns";
import { Request, Response, NextFunction } from "express";
import { calculateChange, calculatePeriodAnalytics } from "@/utils/dashboard";
import prisma from "@/utils/prisma";

export async function fetchAnalytics(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ 
            message: "Could not parse the request. Please use valid parameters.", 
            data: null 
        });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    // Calculate previous period dates
    const daysDifference = differenceInHours(endDate, startDate) / 24;
    const previousStartDate = subDays(startDate, daysDifference);
    const previousEndDate = subDays(endDate, daysDifference);

    // Fetch schedule once
    const schedule = await prisma.schedule.findMany({
        where: {
            pitchId: id
        }
    });

    // Calculate analytics for current and previous periods
    const [currentPeriod, previousPeriod] = await Promise.all([
        calculatePeriodAnalytics(id, startDate, endDate, schedule),
        calculatePeriodAnalytics(id, previousStartDate, previousEndDate, schedule)
    ]);

    // Calculate rates for current period
    const recurringBookersPercent = currentPeriod.totalCustomers > 0 
        ? (currentPeriod.recurringCount / currentPeriod.totalCustomers) * 100 
        : 0;
    
    const newBookersPercent = currentPeriod.totalCustomers > 0 
        ? ((currentPeriod.totalCustomers - currentPeriod.recurringCount) / currentPeriod.totalCustomers) * 100 
        : 0;
    
    const occupancyRate = currentPeriod.totalAvailability > 0 
        ? (currentPeriod.bookedHours / currentPeriod.totalAvailability) * 100 
        : 0;
    
    const cancellationRate = currentPeriod.totalBookings > 0 
        ? (currentPeriod.cancelledCount / currentPeriod.totalBookings) * 100 
        : 0;
    
    const noShowRate = currentPeriod.confirmedCount > 0 
        ? (currentPeriod.noShowCount / currentPeriod.confirmedCount) * 100 
        : 0;
    
    const averageBookingValue = currentPeriod.totalBookings > 0 
        ? currentPeriod.totalRevenue / currentPeriod.totalBookings 
        : 0;

    // Calculate rates for previous period
    const prevRecurringBookersPercent = previousPeriod.totalCustomers > 0 
        ? (previousPeriod.recurringCount / previousPeriod.totalCustomers) * 100 
        : 0;
    
    const prevNewBookersPercent = previousPeriod.totalCustomers > 0 
        ? ((previousPeriod.totalCustomers - previousPeriod.recurringCount) / previousPeriod.totalCustomers) * 100 
        : 0;
    
    const prevOccupancyRate = previousPeriod.totalAvailability > 0 
        ? (previousPeriod.bookedHours / previousPeriod.totalAvailability) * 100 
        : 0;
    
    const prevCancellationRate = previousPeriod.totalBookings > 0 
        ? (previousPeriod.cancelledCount / previousPeriod.totalBookings) * 100 
        : 0;
    
    const prevNoShowRate = previousPeriod.confirmedCount > 0 
        ? (previousPeriod.noShowCount / previousPeriod.confirmedCount) * 100 
        : 0;
    
    const prevAverageBookingValue = previousPeriod.totalBookings > 0 
        ? previousPeriod.totalRevenue / previousPeriod.totalBookings 
        : 0;

    // Generate revenue by ground data
    const revenueByGroundMap = new Map<string, Map<string, number>>();
    const groundsMap = new Map<string, { id: string; name: string }>();

    const targetDates = eachDayOfInterval({ start: startDate, end: endDate })
        .map(date => format(date, 'yyyy-MM-dd'));

    currentPeriod.bookings
        .filter(b => ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(b.status))
        .forEach(booking => {
            const day = booking.startDate.toISOString().split('T')[0];
            const revenuePerGround = booking.totalPrice / booking.grounds.length;
            
            booking.grounds.forEach(ground => {
                groundsMap.set(ground.id, { id: ground.id, name: ground.name });
                
                if (!revenueByGroundMap.has(day)) {
                    revenueByGroundMap.set(day, new Map());
                }
                
                const dayMap = revenueByGroundMap.get(day)!;
                dayMap.set(ground.id, (dayMap.get(ground.id) || 0) + revenuePerGround);
            });
        });

    const revenueByGround = targetDates.map(date => {
        const data: any = { date };
        
        Array.from(groundsMap.keys()).forEach(groundId => {
            const dayMap = revenueByGroundMap.get(date);
            data[groundId] = dayMap?.get(groundId) || 0;
        });
        
        return data;
    });

    // Generate daily trend data for sparklines
    const generateDailyTrend = (bookings: any[], metric: string) => {
        const dailyData = new Map<string, number>();
        
        // Initialize all dates with 0
        targetDates.forEach(date => dailyData.set(date, 0));
        
        bookings.forEach(booking => {
            const day = booking.startDate.toISOString().split('T')[0];
            if (!dailyData.has(day)) return;
            
            const current = dailyData.get(day) || 0;
            
            switch(metric) {
                case 'revenue':
                    if (['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(booking.status)) {
                        dailyData.set(day, current + booking.totalPrice);
                    }
                    break;
                case 'bookings':
                    dailyData.set(day, current + 1);
                    break;
                case 'hours':
                    if (['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'].includes(booking.status)) {
                        const hours = differenceInHours(booking.endDate, booking.startDate);
                        dailyData.set(day, current + (hours * booking.grounds.length));
                    }
                    break;
            }
        });
        
        return targetDates.map(date => dailyData.get(date) || 0);
    };

    // Calculate booking distribution (guest vs user bookings)
    const guestBookings = currentPeriod.bookings.filter(b => b.guestId && !b.userId).length;
    const userBookings = currentPeriod.bookings.filter(b => b.userId).length;

    const bookingDistribution = [
        { name: 'Guest Bookings', value: guestBookings, percentage: currentPeriod.totalBookings > 0 ? (guestBookings / currentPeriod.totalBookings) * 100 : 0 },
        { name: 'User Bookings', value: userBookings, percentage: currentPeriod.totalBookings > 0 ? (userBookings / currentPeriod.totalBookings) * 100 : 0 }
    ];

    // Build analytics response with comparisons and trend data
    const analytics = {
        bookingDistribution,
        totalRevenue: {
            current: currentPeriod.totalRevenue,
            ...calculateChange(currentPeriod.totalRevenue, previousPeriod.totalRevenue),
            trend: generateDailyTrend(currentPeriod.bookings, 'revenue')
        },
        totalBookings: {
            current: currentPeriod.totalBookings,
            ...calculateChange(currentPeriod.totalBookings, previousPeriod.totalBookings),
            trend: generateDailyTrend(currentPeriod.bookings, 'bookings')
        },
        totalCustomers: {
            current: currentPeriod.totalCustomers,
            ...calculateChange(currentPeriod.totalCustomers, previousPeriod.totalCustomers),
            trend: (() => {
                const dailyCustomers = new Map<string, Set<string>>();
                targetDates.forEach(date => dailyCustomers.set(date, new Set()));
                
                currentPeriod.bookings.forEach(booking => {
                    const day = booking.startDate.toISOString().split('T')[0];
                    const customerId = booking.userId || booking.guestId;
                    if (customerId && dailyCustomers.has(day)) {
                        dailyCustomers.get(day)!.add(customerId);
                    }
                });
                
                return targetDates.map(date => dailyCustomers.get(date)?.size || 0);
            })()
        },
        recurringBookersPercent: {
            current: recurringBookersPercent,
            ...calculateChange(recurringBookersPercent, prevRecurringBookersPercent)
        },
        newBookersPercent: {
            current: newBookersPercent,
            ...calculateChange(newBookersPercent, prevNewBookersPercent)
        },
        occupancyRate: {
            current: occupancyRate,
            ...calculateChange(occupancyRate, prevOccupancyRate),
            trend: generateDailyTrend(currentPeriod.bookings, 'hours').map(hours => 
                currentPeriod.totalAvailability > 0 ? (hours / (currentPeriod.totalAvailability / targetDates.length)) * 100 : 0
            )
        },
        cancellationRate: {
            current: cancellationRate,
            ...calculateChange(cancellationRate, prevCancellationRate)
        },
        noShowRate: {
            current: noShowRate,
            ...calculateChange(noShowRate, prevNoShowRate)
        },
        averageBookingValue: {
            current: averageBookingValue,
            ...calculateChange(averageBookingValue, prevAverageBookingValue),
            trend: (() => {
                const dailyRevenue = new Map<string, number>();
                const dailyCount = new Map<string, number>();
                
                targetDates.forEach(date => {
                    dailyRevenue.set(date, 0);
                    dailyCount.set(date, 0);
                });
                
                currentPeriod.bookings
                    .filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status))
                    .forEach(booking => {
                        const day = booking.startDate.toISOString().split('T')[0];
                        if (dailyRevenue.has(day)) {
                            dailyRevenue.set(day, (dailyRevenue.get(day) || 0) + booking.totalPrice);
                            dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
                        }
                    });
                
                return targetDates.map(date => {
                    const count = dailyCount.get(date) || 0;
                    return count > 0 ? (dailyRevenue.get(date) || 0) / count : 0;
                });
            })()
        },
        revenueByGround,
        grounds: Array.from(groundsMap.values())
    };

    return res.status(200).json({ 
        message: "Fetched analytics data successfully.", 
        analytics 
    });
};
