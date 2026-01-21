# Hagz
## Project Overview

**Goal:** Develop a fully fledged B2B2C system that can handle pitch booking in Egypt. This system will be self-scalable and self-maintainable with as little effort as possible from both the user's side and the owner's side.

**How we will achieve this goal:** 

1) The user to book as quick as possible in less than 3 clicks.
2) The owner to view their bookings as fast as possible.
3) The owner to manage and maintain incoming bookings from different sources with as minimum friction as possible.

**How this system will be monetized:**

- We will charge a flat 15 EGP service fee per hour booked for the user's side. (That corresponds to a 1.5 EGP per user for a 5-a-side pitch booked to capacity.)
- For every booking we hold 5% of the booking from the owner's side.
- Assuming a pitch with *two* grounds, and *3* bookings of *two* hours each, at a rate of 30 EGP/hr: We can expect to generate about 360 EGP per pitch per day.
- If we scale to 100 pitches across Alexandria and average out at that rate across the year: We can generate about 15M EGP per annum.

## Project Architecture

**The current status quo:**

Owners are disconnected from users and have to search for users to book their ground. They handle client acquistion and may fall into the trap of double booking or under booking their pitch. Their bookings come from disconnected methods: Whatsapp, phone, or in-person. Each of these methods have their own caveats for both the user and owner from a financial, time, and security standpoint.

1) Whatsapp
    - User may fall into an argument with the pitch owner due to double booking by mistake because bookings aren't centralized.
    - If the user will pay in cash, the owner does not get a guarantee that the user shows up.
    - User may not be able to get an instant response from the owner.
    - The owner is not sure of the identity of the person booking. They only go off by a name, which means when other players show up, the owner has no idea of knowing which booking is for which player.

2) Phone
    - User may fall into an argument with the pitch owner due to double booking by mistake because bookings aren't centralized.
    - If the user will pay in cash, the owner does not get a guarantee that the user shows up.
    - User may not be able to get an instant response from the owner.
    - The owner is not sure of the identity of the person booking. They only go off by a name, which means when other players show up, the owner has no idea of knowing which booking is for which player.

3) In-Person
    - User may fall into an argument with the pitch owner due to double booking by mistake because bookings aren't centralized.
    - User does not know the pitch operating hours.
    - The owner does not remember the identity of the person booking. They only go off by a name, which means when other players show up, the owner has no idea of knowing which booking is for which player.
    - It takes both time, effort, and money to go to the pitch directly.

**How do we solve these issues?**

1) For Whatsapp:

    Provide an AI agent that generates `hagz.com/pitch/:id/book` links through a series of questions, and keep it as short as possible for the user. This streamlines the process by reducing overhead and friction from the owner's side, creating fast, quick, and sustainable replies. It also takes away from the maintenance the owner has to do by adding the booking to the pitch's calendar.

2) For Phones:

    The owner gets a phone call, adds the booking to the system through the calendar within 1 minute, and confirms with the user on the phone. A QR code, SMS, or link can then be sent to the user with the phone number used to make that booking.

3) For In-Person:

    The owner gets a walk-in customer, adds the booking to the system and provides the customer with a QR code if they need to come back later. An SMS also hits their phone instantly confirming their booking.

**How do we allow this system to be self-scalable and self-maintainable:**
1) The user needs to be able to find pitches.
    - Do so through maps to allow radius search.
    - Do so through a search by name view.

    Both of these can be filtered by:
    - Sport
    - Price range
    - Amenities
    - Ground size (if football)
    - Ground type
    - Payment method

2) The user needs to be able to book using different payment methods and for different schedules.
    - The user selects the pitch and is redirected to a /book page.
    - Allow the user to book using credit card, wallet, or cash (based on what the owner sets per pitch policy).
    - Booking page will set query parameters based on inputs from user or AI agent.
    - Booking page will allow the user to set the schedule of the booking if they want to it be recurring.
        - Set the frequency.
        - Set the interval.
        - Set the days of week.
    - The policy will be set specifically per pitch.

3) The owners need to be able to sign up directly on the platform without the friction of getting in contact with an application customer support team.
    - We minimize this as much as possible by allowing the owner to add their pitches and grounds without contact.
    - The only thing we need is to verify the identity and ownership of the owner with their pitch.

4) The owners need to be able to track their bookings.
    - Provide the owner with a dashboard to view calendar.
    - Check the booking details.
    - Add new bookings.
    - Update booking details while protecting user rights.
    - Verify a booking by scanning a QR code directly.

5) Owners need to be able to add subsidiaries to help them with their bookings and pitch management.
    - Be able to add managers by creating invitations.
    - Track actions taken by who on their pitch.
    - Give certain managers certain permissions.
    - Be able to transfer ownership of the pitch to another account.

6) Owners need to set up the payment schedule, policy, and methods for the pitch.
    - Allow at least one payment method.
    - If the payment method is credit card or wallet:
    
        Create booking. Pay for booking. System confirms booking.

    - If the payment method is in cash:

        1) Either allow cash bookings but keep the booking pending until the owner confirms it and holds your spot.
        2) Or allow cash bookings and confirm it automatically.
        3) Or allow cash bookings but require an instant deposit first to confirm the booking and hold your spot.

    - We will set standard rules that protect the user and owner.
        * If the user cancels (time-based policy):
            - If the booking is cancelled 24 hours prior to the start date, no fees are lost.
            - If the booking is cancelled between 6 hours and 24 hours to the start date, 35% of the fees are lost.
            - If the booking is cancelled between 2 hours and 6 hours to the start date, 70% fees are lost.
            - If the booking is cancelled less than 2 hours before the start date, all fees are lost.
            - If the payment is in cash, deposits may not be refunded to protect the owner.
            - If the payment is in cash and no refund policy has been set to protect the owner, repeated no-shows within a specific timeframe gets the account flagged.
                * What this looks like is a banner that tells the user that their account has been flagged due to repeated violations of the cancellation policy.
                * Users should know when/why their account gets flagged.
                * 1 no-show within 90 days is acceptable.
                * 2 no-shows within 90 days gives a soft-warning for the user.
                * 3 no-shows within 90 days makes the user's account restricted. They may not pay in cash, they must pay upfront.
                * 4 no-shows within 90 days warrants a temporary 14 day suspension.
            - Do not show the owner the rate of cancellations for the user. Just give them a nudge/heads-up message.
        * If the owner cancels:
            - Refund the full amount immidiately to the user and give them a 5% discount off their next booking.
            - Make sure that the owner does not abuse this. Make the user understand the importance of marking false no-shows on cash bookings.
            - Provide the user with an interface to report false no-shows.
            - Emergency conditions are allowed, the owner needs to pick one of the possible emergency situations.

7) Future work/plans
    - Add a social system that allows users to connect with bookings that need remaining players.
    - Add a tournament system for people to organize tournaments sponsored by Hagz.
    - Add a Hagz-specific events that only users can attend to.
    - Introduce a system for academies and teams with specific features to attend to them.

## Project (Monorepo) Stack
- Frontend: Next.js
- Backend: Express
- Database: PostgreSQL + PostGIS
- ORM: Prisma
- Auth: JWT + OAuth
- Payments: Paymob/Fawry
- Maps: Google Maps
- Caching + Locks: Redis
- Worker: BullMQ
- Notifications: SMSMisr, then migrate over to Twilio if we need global coverage.
- Infrastructure: Docker, Vercel, AWS
- Logging, Monitoring, Alerts: Sentry, Axiom, Pino, Bullboard

## Project Domains/Concepts
- Each queryable place is a pitch. This is where longitude and latitude data will be stored.
- For every pitch there is a bookable sub-unit, the ground.
- There must be an owner for every pitch. This is the user that creates the pitch.
- There must be a user to book the ground.
- A user may have multiple accounts/sign-in methods. Phone numbers will be the primary method.
- A pitch will have amenities. Each amenity is a model that includes its name, price, additional description, etc...
- A pitch must include its layout when created. This will be stored as JSON.
- Grounds can be grouped into combinations, this, however, is a mental model not an actual model within the database.
- A pitch must include its schedule. This will also be stored as JSON but within the ground.
- A user may own multiple pitches and manage some others, which is why we need a permissions table.
- The user must be able to book grounds. This is the booking model.
- A booking must be paid for. This is the payment model.
- A payment may be refunded. This is the refund model.
- A booking may be a part of a series of recurring bookings. This is the recurringBooking model.
- Double bookings MUST be protected against by using both a transaction and a database lock.
- An owner can invite more managers to the pitch. This is the invitation model.
- User preferences will be stored as fields within the user model.

## Project Views

We will split this into 3 main domains:

- Shared
    1) Home Page `/`
    2) Search Page (Map/Card View) `/search`
    3) Pitch Details View `/pitch/:id`
    4) Book Pitch View `/pitch/:id/ground/:id/book`
    5) Quick Book View `/pitch/:id/book?start=&end=&target=`
    6) Checkout/Payment Gateway View `/checkout?token=`
    7) Booking Details Page `/booking/:id`
    8) Profile Details
        - Overview `/profile`
        - Bookings `/profile/history`
        - Settings `/profile/settings`
    9) How it works `/model`
    10) Policy `/policy`
    11) Contact `/contact`
    12) FAQs `/faq`

- Auth
    1) Sign In `/auth/sign-in`
    2) Owner Sign Up `/auth/owner/sign-up`
    3) User Sign Up `/auth/user/sign-up`
    4) Accept Pitch Invitation `/auth/invitation/:id`
    5) Manager Sign Up `/auth/manager/sign-up?redirect=`
    6) Forgot Password `/auth/forgot-password`
    7) Verify Phone `/auth/verify`
- Dashboard
    1) Onboarding `/dashboard/onboarding`
    2) Home (Calendar + Quick Actions) `/dashboard`
    3) Bookings `/dashboard/bookings`
    4) Analytics `/dashboard/analytics`
    5) Payouts `/dashboard/payments`
    6) Add Booking `/dashboard/bookings/add`
    7) View/Update Booking `/dashboard/booking/:id`
    8) Add Pitch `/dashboard/pitch/create`
    9) Update Pitch
        - Details & Settings `/dashboard/pitch/details`
        - View/Add/Update Grounds Per Pitch `/dashboard/pitch/layout`
        - Policy `/dashboard/pitch/policy`
        - Team & Invitations `/dashboard/pitch/team`

## Project Architecture

```
/ui
    /(shared)
    /dashboard
    /auth
    /components
    /schemas
    /utils
/api
    /src
        /domains
            /auth
            /pitch
            /booking
            /user
            /dashboard
            /invitations
            /payments
            /notifications
        /shared
            /middleware
            /workers
            /lib
/docs
```

## Author & Credits
© 2026 Ammar Sarhan. MIT license.