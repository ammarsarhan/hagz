import { Request, Response, NextFunction } from "express";
import z from "zod";
import { addHours, format, getDay, getHours } from "date-fns";

import prisma from "@/utils/prisma";
import { calculateBookingPrice, checkTimeslotAvailability, resolveLastBookingData, resolvePitchTargets, scheduleBookingJobs, TimeSlot } from "@/services/bookingService";
import { Bookings, createSchema, fetchSchema, generateRecurringDates, generateReferenceCode, getIntervalAmount, ResolvedSettings, resolveInitialBookingStatus } from "@/utils/booking";

export async function fetchConstraints(req: Request, res: Response, next: NextFunction) {
    const pitchId = req.params.id;

    if (!pitchId) {
        return res.status(400).json({
            message: "Could not fetch pitch data. ID was not passed into the query parameters.",
            data: null
        });
    };

    const pitch = await prisma.pitch.findUnique({ 
        where: { 
          id: pitchId,
          layout: {
            grounds: {
              every: {
                status: "LIVE"
              }
            }
          }
        },
        select: {
            id: true,
            name: true,
            status: true,
            layout: {
                select: {
                    grounds: {
                        select: {
                            id: true,
                            name: true,
                            effectiveSettings: true
                        }
                    },
                    combinations: {
                        select: {
                            id: true,
                            name: true,
                            effectiveSettings: true
                        }
                    }
                }
            },
            schedule: {
                omit: {
                    id: true
                }
            },
            settings: true
        }
    });

    if (!pitch || !pitch.layout || !pitch.settings) {
        return res.status(404).json({ message: "Could not find pitch with the specified ID. Please try again later.", data: null });
    };

    const targets = resolvePitchTargets(pitch.layout, pitch.settings);

    return res.status(200).json({ message: "Fetched pitch booking constraints successfully.", data: {
        pitch,
        targets
    } });
}

export async function fetchSingleTimeslots(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const { target, type, date } = req.query;

        // Validate query parameters
        const schema = z.object({
            target: z.uuid("Please enter a valid target query parameter."),
            type: z.enum(["GROUND", "COMBINATION"], "Please enter a valid target type."),
            date: z.string().transform((str) => new Date(str))
        });
        
        const parsed = schema.safeParse({ target, type, date });

        if (!parsed.success) {
            return res.status(400).json({ 
                message: parsed.error.issues[0].message, 
                data: null 
            });
        };

        const payload = parsed.data;

        // Build target dates for the next 6 hours
        const targetSlots: Array<{ startTime: Date; endTime: Date }> = [];
        const scheduleDays = new Set<number>();

        for (let i = 0; i < 6; i++) {
            const slotStart = addHours(payload.date, i);
            const slotEnd = addHours(slotStart, 1);
            
            scheduleDays.add(getDay(slotStart));
            targetSlots.push({ startTime: slotStart, endTime: slotEnd });
        }

        // Fetch pitch with conditional layout data
        const pitch = await prisma.pitch.findUnique({
            where: { id, status: "LIVE" },
            select: {
                id: true,
                name: true,
                schedule: {
                    where: {
                        dayOfWeek: {
                            in: Array.from(scheduleDays)
                        }
                    }
                },
                ...(payload.type === "GROUND" && {
                    layout: {
                        select: {
                            grounds: {
                                where: { 
                                    id: payload.target,
                                    status: "LIVE"
                                },
                                include: {
                                    bookings: {
                                        where: {
                                            status: { notIn: ["EXPIRED", "CANCELLED", "REJECTED"] },
                                            OR: [
                                                {
                                                    startDate: {
                                                        gte: payload.date,
                                                        lt: addHours(payload.date, 6)
                                                    }
                                                },
                                                {
                                                    endDate: {
                                                        gt: payload.date,
                                                        lte: addHours(payload.date, 6)
                                                    }
                                                },
                                                {
                                                    AND: [
                                                        { startDate: { lte: payload.date } },
                                                        { endDate: { gte: addHours(payload.date, 6) } }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }),
                ...(payload.type === "COMBINATION" && {
                    layout: {
                        select: {
                            combinations: {
                                where: { 
                                    id: payload.target
                                },
                                include: {
                                    grounds: {
                                        where: {
                                            status: "LIVE"
                                        },
                                        select: {
                                            id: true,
                                            name: true,
                                            bookings: {
                                                where: {
                                                    status: { notIn: ["EXPIRED", "CANCELLED", "REJECTED"] },
                                                    OR: [
                                                        {
                                                            startDate: {
                                                                gte: payload.date,
                                                                lt: addHours(payload.date, 6)
                                                            }
                                                        },
                                                        {
                                                            endDate: {
                                                                gt: payload.date,
                                                                lte: addHours(payload.date, 6)
                                                            }
                                                        },
                                                        {
                                                            AND: [
                                                                { startDate: { lte: payload.date } },
                                                                { endDate: { gte: addHours(payload.date, 6) } }
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
            }
        });

        if (!pitch || !pitch.layout || !pitch.schedule) {
            return res.status(404).json({ 
                message: "Pitch not found. Please try again later.", 
                data: null 
            });
        };

        let selectedTarget: any;
        let targets: any[] = [];
        let effectiveSettings: any;

        const layout = pitch.layout as any;

        if (payload.type === "GROUND") {
            const grounds = layout.grounds || [];

            if (grounds.length === 0) {
                return res.status(404).json({ 
                    message: "Could not find any live grounds. Please check your grounds' status and try again later.", 
                    data: null 
                });
            };

            selectedTarget = grounds[0];
            targets = [selectedTarget];
            effectiveSettings = selectedTarget.effectiveSettings;
        } else {
            const combinations = layout.combinations || [];
            if (combinations.length === 0) {
                return res.status(404).json({ 
                    message: "Combination not found. Please try again later.", 
                    data: null 
                });
            }

            selectedTarget = combinations[0];
            targets = selectedTarget.grounds;
            effectiveSettings = selectedTarget.effectiveSettings;
        }

        // Fetch schedule exceptions
        const exceptions = await prisma.scheduleException.findMany({
            where: {
                OR: [
                    { target: "PITCH", targetId: id },
                    { target: payload.type, targetId: payload.target }
                ],
                startDate: { lte: addHours(payload.date, 6) },
                endDate: { gte: payload.date }
            }
        });

        // Process each slot
        const slots: TimeSlot[] = targetSlots.map(({ startTime, endTime }) => {
            const dayOfWeek = getDay(startTime);
            const hour = getHours(startTime);
            
            // 1. Find schedule for this day
            const schedule = pitch.schedule.find(s => s.dayOfWeek === dayOfWeek);

            if (!schedule) {
                return {
                    startTime,
                    endTime,
                    available: false,
                    price: 0,
                    isPeakHour: false,
                    isOffPeakHour: false,
                    reason: "No schedule found for this day."
                };
            }

            // 2. Check if pitch is closed
            if (schedule.openTime === 0 && schedule.closeTime === 0) {
                return {
                    startTime,
                    endTime,
                    available: false,
                    price: 0,
                    isPeakHour: false,
                    isOffPeakHour: false,
                    reason: "Pitch is closed on this day."
                };
            }

            // 3. Check if hour is within operating hours
            if (hour < schedule.openTime || hour >= schedule.closeTime) {
                return {
                    startTime,
                    endTime,
                    available: false,
                    price: 0,
                    isPeakHour: false,
                    isOffPeakHour: false,
                    reason: `Outside operating hours (${schedule.openTime}:00 - ${schedule.closeTime}:00).`
                };
            }

            // 4. Check for schedule exceptions
            const hasException = exceptions.find(ex => 
                startTime >= ex.startDate && startTime < ex.endDate
            );

            if (hasException) {
                return {
                    startTime,
                    endTime,
                    available: false,
                    price: 0,
                    isPeakHour: false,
                    isOffPeakHour: false,
                    reason: hasException.reason || "Maintenance/Exception scheduled."
                };
            }

            // 5. Check for booking conflicts
            const conflicts: Array<{
                referenceCode: string;
                groundName?: string;
                startTime: Date;
                endTime: Date;
            }> = [];

            targets.forEach(ground => {
                ground.bookings?.forEach((booking: any) => {
                    const bookingStart = new Date(booking.startDate);
                    const bookingEnd = new Date(booking.endDate);

                    const overlaps =
                        (startTime >= bookingStart && startTime < bookingEnd) ||
                        (endTime > bookingStart && endTime <= bookingEnd) ||
                        (startTime <= bookingStart && endTime >= bookingEnd);

                    if (overlaps) {
                        conflicts.push({
                            referenceCode: booking.referenceCode,
                            groundName: ground.name,
                            startTime: bookingStart,
                            endTime: bookingEnd
                        });
                    }
                });
            });

            if (conflicts.length > 0) {
              const details = [...new Set(conflicts.map(c => c.referenceCode))].join(", ");

              return {
                  startTime,
                  endTime,
                  available: false,
                  price: 0,
                  isPeakHour: false,
                  isOffPeakHour: false,
                  reason: `Booked: ${details}`
              };
            }

            // 6. Calculate price for this hour
            let hourPrice = selectedTarget.price;
            let isPeakHour = false;
            let isOffPeakHour = false;

            if (schedule.peakHours.includes(hour)) {
                isPeakHour = true;
                hourPrice += (hourPrice * effectiveSettings.peakHourSurcharge) / 100;
            } else if (schedule.offPeakHours.includes(hour)) {
                isOffPeakHour = true,
                hourPrice -= (hourPrice * effectiveSettings.offPeakDiscount) / 100;
            }

            // 7. All checks passed - slot is available
            return {
                startTime,
                endTime,
                available: true,
                price: Math.round(hourPrice),
                isPeakHour,
                isOffPeakHour
            };
        });

        return res.status(200).json({ 
            message: "Fetched booking availability data successfully.", 
            metadata: {
                id: id,
                name: pitch.name,
                target: payload.target,
                type: payload.type,
                requestedDate: payload.date,
                effectiveSettings: {
                  minBookingHours: effectiveSettings.minBookingHours,
                  maxBookingHours: effectiveSettings.maxBookingHours,
                  basePrice: selectedTarget.price
                }
            },
            data: slots
        });

    } catch (error) {
        console.error("Error fetching timeslots:", error);

        return res.status(500).json({ 
            message: "Internal server error",
            data: null,
            error: error instanceof Error ? error.message : "Unknown error."
        });
    }
};

export async function fetchPitchAccountData(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    const { target } = req.query;

    if (!id || !target) {
        return res.status(400).json({ message: "Please use a valid pitch ID and phone number to query for pitch guests.", data: null });
    };

    const guest = await prisma.guest.findFirst({ 
        where: {
          pitchId: id,
          phone: target as string
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            bookings: {
              orderBy: {
                createdAt: "desc"
              },
              select: {
                startDate: true,
                endDate: true,
                grounds: {
                  select: {
                    name: true
                  }
                },
                paymentMethod: true
              }
            }
        }
    });

    const user = await prisma.user.findFirst({ 
        where: {
          phone: target as string
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            bookings: {
              where: {
                pitchId: id
              },
              orderBy: {
                createdAt: "desc"
              },
              select: {
                startDate: true,
                endDate: true,
                grounds: {
                  select: {
                    name: true
                  }
                },
                paymentMethod: true
              }
            }
        }
    });

    if (guest && guest.bookings.length > 0) {
      const booking = resolveLastBookingData({ account: guest });
  
      return res.status(200).json({ 
        message: "Fetched guest details successfully.", 
        data: { 
          guest: {
            firstName: guest.firstName,
            lastName: guest.lastName,
            phone: guest.phone,
            booking
          } 
        }
      });
    };
    
    if (user) {
      const booking = resolveLastBookingData({ account: user });
  
      return res.status(200).json({ 
        message: "Fetched user details successfully.", 
        data: { 
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            booking
          } 
        }
      });
    }
};

export async function createManagerBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { payload } = req.body;

    const parsed = createSchema.safeParse({...payload});
    
    if (!parsed.success) {
      return res.status(400).json({
        message: "Could not parse booking data successfully.",
        errors: parsed.error.issues[0].message,
        data: null
      });
    }

    const data = parsed.data;

    // Get or create user/guest.
    const { firstName, lastName, phone, targetType } = data;
    
    let user = await prisma.user.findUnique({ where: { phone } });
    let guest = null;

    if (!user) {
      guest = await prisma.guest.findUnique({ 
        where: { 
          phone_pitchId: {
            phone,
            pitchId: id
          }
       } 
      });
      
      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            firstName,
            lastName,
            phone,
            pitchId: id,
            notes: data.notes
          }
        });
      }
    }

    // Use Prisma transaction for race condition protection.
    const result = await prisma.$transaction(async (tx) => {
      // Check availability using the robust function.
      const availabilityCheck = await checkTimeslotAvailability(
        id,
        data.target,
        targetType,
        data.timeslots
      );

      if (!availabilityCheck.available) {
        throw new Error(availabilityCheck.reason || "Timeslots not available.");
      };

      // Calculate price with peak/off-peak considerations.
      const totalPrice = await calculateBookingPrice(
        id,
        data.target,
        targetType,
        data.timeslots
      );

      // Get pitch settings for deadlines.
      const pitchSettings = await tx.pitchSettings.findUnique({
        where: { pitchId: id },
        select: {
          cancellationGrace: true,
          automaticBookings: true,
          minBookingHours: true,
          maxBookingHours: true,
          cancellationFee: true,
          noShowFee: true,
          advanceBooking: true,
          paymentDeadline: true,
          peakHourSurcharge: true,
          offPeakDiscount: true
        }
      });

      if (!pitchSettings) return res.status(404).json({ message: "Could not find pitch data associated with the specified ID." });

      let settings: ResolvedSettings;

      if (data.targetType === "GROUND") {
        const ground = await prisma.ground.findUnique({ where: { id: data.target }, select: { effectiveSettings: true } });
        if (!ground) return res.status(404).json({ message: "Could not find a ground with the specified ID." });

        settings = ground.effectiveSettings as unknown as ResolvedSettings;
      } else if (data.targetType === "COMBINATION") {
        const combination = await prisma.combination.findUnique({ where: { id: data.target }, select: { effectiveSettings: true } });
        if (!combination) return res.status(404).json({ message: "Could not find a combination with the specified ID." });

        settings = combination.effectiveSettings as unknown as ResolvedSettings;
      } else {
        settings = {
          ...pitchSettings
        }
      }

      // Calculate deadlines.
      const firstTimeslot = data.timeslots[0];
      const lastTimeslot = data.timeslots[data.timeslots.length - 1];
      
      const paymentDeadline = new Date(firstTimeslot.startTime);
      paymentDeadline.setHours(paymentDeadline.getHours() - (settings.paymentDeadline || 3));
      
      const cancellationDeadline = new Date(firstTimeslot.startTime);
      cancellationDeadline.setHours(cancellationDeadline.getHours() - (pitchSettings.cancellationGrace || 1));

      // Handle recurring bookings.
      if (data.recurringOptions) {
        const { frequency, interval, occurrences, endsAt, payment } = data.recurringOptions;
        
        const recurringDates = generateRecurringDates(
          data.startDate,
          occurrences,
          interval,
          endsAt
        );

        // Validate all recurring dates are available.
        for (const date of recurringDates) {
          const recurringTimeslots = data.timeslots.map(slot => {
            const start = new Date(date);
            start.setHours(getHours(slot.startTime), slot.startTime.getMinutes());
            
            const end = new Date(date);
            end.setHours(getHours(slot.endTime), slot.endTime.getMinutes());
            
            return { startTime: start, endTime: end };
          });

          const check = await checkTimeslotAvailability(
            id,
            data.target,
            targetType,
            recurringTimeslots
          );

          if (!check.available) {
            throw new Error(`Recurring booking on ${format(date, 'MMM dd, yyyy')} is not available: ${check.reason}`);
          }
        };

        // Create recurring booking record.
        const recurringBooking = await tx.recurringBooking.create({
          data: {
            frequency: frequency,
            interval: getIntervalAmount(interval).amount,
            recurrenceEndsAt: endsAt,
            paymentSchedule: payment
          }
        });

        // Create individual bookings for each occurrence.
        const bookings = [];

        for (const date of recurringDates) {
          const occurrenceTimeslots = data.timeslots.map(slot => {
            const start = new Date(date);
            start.setHours(getHours(slot.startTime), slot.startTime.getMinutes());
            
            const end = new Date(date);
            end.setHours(getHours(slot.endTime), slot.endTime.getMinutes());
            
            return { startTime: start, endTime: end };
          });

          const occurrencePrice = await calculateBookingPrice(
            id,
            data.target,
            targetType,
            occurrenceTimeslots
          );

          const isPaid = data.paymentMethod === null;
          const isCash = data.paymentMethod === "CASH";

          const bookingStatus = resolveInitialBookingStatus(
              !!user, 
              pitchSettings.automaticBookings, 
              isPaid,
              isCash,
              true
          );

          let grounds = [];

          if (targetType === 'COMBINATION') {
            const combination = await tx.combination.findUnique({
              where: { id: data.target },
              include: { grounds: true },
            });
            
            if (!combination) {
              throw new Error("Combination not found. Please try again later.");
            };
            
            grounds = combination.grounds.map(g => ({ id: g.id }));
          } else {
            grounds = [{ id: data.target }];
          };

          const booking = await tx.booking.create({
            data: {
              referenceCode: generateReferenceCode(),
              status: bookingStatus,
              source: data.source,
              issuerId: req.user?.sub!,
              pitchId: id,
              userId: user?.id,
              guestId: guest?.id,
              grounds: {
                connect: grounds
              },
              recurrenceId: recurringBooking.id,
              startDate: occurrenceTimeslots[0].startTime,
              endDate: occurrenceTimeslots[occurrenceTimeslots.length - 1].endTime,
              totalPrice: payment === "ONE_TIME" ? totalPrice * recurringDates.length : occurrencePrice,
              paymentDeadline,
              cancellationDeadline,
              notes: data.notes,
              isPaid: data.paymentMethod === null,
              paymentMethod: data.paymentMethod
            },
            include: {
              grounds: true,
              user: true,
              guest: true
            }
          });

          // Add jobs for the created booking.
          scheduleBookingJobs(booking.id, !!booking.userId, booking.isPaid || booking.paymentMethod === "CASH", booking.startDate, booking.endDate, settings);

          bookings.push(booking);
        }

        return { bookings, isRecurring: true };
      };

      const isPaid = data.paymentMethod === null;
      const isCash = data.paymentMethod === "CASH";

      const bookingStatus = resolveInitialBookingStatus(
          !!user, 
          pitchSettings.automaticBookings, 
          isPaid,
          isCash,
          true
      );

      let grounds = [];

      if (targetType === 'COMBINATION') {
        const combination = await tx.combination.findUnique({
          where: { id: data.target },
          include: { grounds: true },
        });
        
        if (!combination) {
          throw new Error("Combination not found. Please try again later.");
        };
        
        grounds = combination.grounds.map(g => ({ id: g.id }));
      } else {
        grounds = [{ id: data.target }];
      };

      // Create single booking.
      const booking = await tx.booking.create({
        data: {
          referenceCode: generateReferenceCode(),
          status: bookingStatus,
          source: data.source,
          issuerId: req.user?.sub!,
          pitchId: id,
          guestId: guest?.id,
          userId: user?.id,
          grounds: {
            connect: grounds
          },
          startDate: firstTimeslot.startTime,
          endDate: lastTimeslot.endTime,
          totalPrice,
          paymentDeadline,
          cancellationDeadline,
          notes: data.notes,
          isPaid: data.paymentMethod === null,
          paymentMethod: data.paymentMethod
        },
        include: {
          grounds: true,
          user: true,
          guest: true
        }
      });

      // Add jobs for the created booking.
      scheduleBookingJobs(booking.id, !!booking.userId, booking.isPaid || booking.paymentMethod === "CASH", booking.startDate, booking.endDate, settings);

      return { booking, isRecurring: false };
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    });

    return res.status(201).json({
      message: "Booking created successfully.",
      data: result
    });

  } catch (error: any) {
    console.log(error.message);

    return res.status(500).json({
      message: "A server-side error has occurred. Failed to create booking.",
      error: error.message,
      data: null
    });
  }
};

export async function fetchBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { target, type, start, end, status } = req.query;

    // Validate query parameters - pass as strings, schema will transform
    const parsed = fetchSchema.safeParse({ 
      target, 
      type, 
      start, 
      end, 
      status,
      page: req.query.page,
      limit: req.query.limit
    });

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0].message,
        data: null
      });
    }

    const payload = parsed.data;

    const page = payload.page || 1;
    const limit = Math.min(payload.limit || 50, 100);
    const skip = (page - 1) * limit;

    const pitch = await prisma.pitch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        layout: {
          select: {
            id: true,
            grounds: payload.type === "GROUND" && payload.target ? {
              where: { id: payload.target },
              select: { id: true, name: true }
            } : payload.type === "ALL" || !payload.target ? {
              select: { id: true, name: true }
            } : true,
            combinations: payload.type === "COMBINATION" && payload.target ? {
              where: { id: payload.target },
              select: { 
                id: true, 
                name: true,
                grounds: {
                  select: { id: true }
                }
              }
            } : true
          }
        }
      }
    });

    if (!pitch || !pitch.layout) {
      return res.status(404).json({
        message: "Could not fetch pitch details with the specified ID.",
        data: null
      });
    }

    // Determine target grounds.
    const layout = pitch.layout as any;

    let targets: string[] = [];
    let name: string = "";

    if (payload.type === "ALL") {
      // Fetch all grounds for this pitch.
      const allGrounds = layout.grounds || [];

      if (allGrounds.length === 0) {
        return res.status(404).json({
          message: "No grounds found for this pitch.",
          data: null
        });
      };

      targets = allGrounds.map((g: any) => g.id);
      name = "All Grounds";
    } else if (payload.type === "GROUND") {
      const grounds = layout.grounds || [];

      if (grounds.length === 0) {
        return res.status(404).json({
          message: "Ground not found.",
          data: null
        });
      };

      targets = [payload.target!];
      name = grounds[0].name;
    } else {
      const combinations = layout.combinations || [];

      if (combinations.length === 0) {
        return res.status(404).json({
          message: "Combination not found",
          data: null
        });
      };

      targets = combinations[0].grounds.map((g: any) => g.id);
      name = combinations[0].name;
    }

    // Build date filter
    const dateFilter: any[] = [];
    
    if (payload.end) {
      // If end date is provided, find bookings that overlap with the range.
      dateFilter.push(
        // Booking starts within range.
        {
          startDate: {
            gte: payload.start,
            lte: payload.end
          }
        },
        // Booking ends within range.
        {
          endDate: {
            gte: payload.start,
            lte: payload.end
          }
        },
        // Booking spans entire range
        {
          AND: [
            { startDate: { lte: payload.start } },
            { endDate: { gte: payload.end } }
          ]
        }
      );
    } else {
      // If no end date, find all bookings starting from the start date
      dateFilter.push({
        OR: [
          // Booking starts on or after start date
          {
            startDate: {
              gte: payload.start
            }
          },
          // Booking ends on or after start date (ongoing bookings)
          {
            endDate: {
              gte: payload.start
            }
          }
        ]
      });
    }

    // Build where clause
    const clause: any = {
      pitchId: id,
      grounds: {
        some: {
          id: { in: targets }
        }
      },
      ...(payload.status ? {
        status: payload.status
      } : {
        status: {
          // notIn: ["EXPIRED", "REJECTED", "CANCELLED"]
        }
      }),
      OR: dateFilter
    };

    // Get total count for pagination
    const total = await prisma.booking.count({
      where: clause
    });

    // Fetch bookings with pagination
    const bookings = await prisma.booking.findMany({
      where: clause,
      select: {
        id: true,
        referenceCode: true,
        status: true,
        source: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        notes: true,
        recurrenceId: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        guest: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        grounds: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      },
      skip,
      take: limit
    });

    const data: Bookings[] = bookings.map(booking => ({
      id: booking.id,
      referenceCode: booking.referenceCode,
      status: booking.status,
      source: booking.source,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalPrice: booking.totalPrice,
      notes: booking.notes,
      issuedTo: booking.user ? `${booking.user.firstName} ${booking.user.lastName}` : `${booking.guest!.firstName} ${booking.guest!.lastName}`,
      grounds: booking.grounds,
      isRecurring: !!booking.recurrenceId,
      createdAt: booking.createdAt
    }));

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return res.status(200).json({
      message: "Bookings fetched successfully for the specified target.",
      metadata: {
        id: id,
        target: payload.target || null,
        type: payload.type,
        name: name,
        dateRange: {
          start: payload.start,
          end: payload.end || null
        },
        status: payload.status || null
      },
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNext,
        hasPrevious
      },
      bookings: data
    });

  } catch (error) {
    console.error("Error fetching bookings:", error);

    return res.status(500).json({
      message: "Internal server error",
      data: null,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}