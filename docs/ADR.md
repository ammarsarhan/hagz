# Architecture Decision Record
This document will outline the decisions taken for the structuring of our application, model by model.

## Pitch
The schema has the following structure for the Pitch model:
```
model Pitch {
    id            String  @id @default(cuid())
    nameEn        String
    descriptionEn String
    nameAr        String
    descriptionAr String
    taxId         String?

    street         String
    area           String
    city           String
    country        Country
    latitude       Float
    longitude      Float
    googleMapsLink String
    amenityList    AmenityType[]

    status PitchStatus @default(UNVERIFIED)

    images     String[]
    coverImage String?

    layout          Json
    groundCount     Int           @default(0)
    availableSports GroundSport[]
    availableSizes  GroundSize[]
    hasCombinations Boolean       @default(false)
    minimumPrice Int
    maximumPrice Int
    earliestHour Int
    latestHour   Int
    openDays     Int[]

    staff     Staff[]
    amenities Amenity[]
    grounds   Ground[]

    submittedAt DateTime
    approvedAt  DateTime?
    approvedBy  String?
    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt

    @@index([country, city, status])
    @@index([longitude, latitude])
}
```

### Name and description
We will primarily be targeting a bilingual demographic, which means that we need two language fields.
We do not create a JSON field or split this into a table for ease of querying and that our needs do not justify the additional query overhead.

```
nameEn        String
descriptionEn String
nameAr        String
descriptionAr String
```

### Tax Identification Number
Tax ID will be optional because the owner may not know the exact value at the time of creation. It will be filled later during the verification/confirmation process.

```
taxId         String?
```

### Address/Localization
Street, area, and city fields can be computed into Arabic through transliteration. To avoid overcomplication, the user will enter the values in English and let our frontend handle translating it. The country will be an enum such that the user doesn't have to pick from an unavailable/unsupported country. We did not add timezone and currency enums because it can be inferred from the country through a config file on the frontend/backend.

```
street         String
area           String
city           String
country        Country
```

### Location
Longitude and latitude are stored as a float in this iteration of the schema and will later be updated to include support for radius-based querying using PostGIS. We did not start off with PostGIS implementation straight away because its types are unsupported by Prisma and we do not need to introduce it while onboarding the owner yet. The googleMapsLink is a simple string pointing to the location with application-level checks.

```
latitude       Float
longitude      Float
googleMapsLink String
```

### Additional Information
Amenity list is a computed property from the Amenity relation on the model. We have made it denormalized and available on the pitch to avoid having to join on every query looking for amenities. Status is a field that encapsulates all of the possible states of the pitch. This needs to be coordinated in the future with the state of the grounds, such that if there are no active grounds the pitch can not be seen as available in queries. Images are an array of URLs and the coverImage is one string URL.

```
amenityList    AmenityType[]
status PitchStatus @default(UNVERIFIED)
images     String[]
coverImage String?
```

### Layout Metadata
We need to be able to retrieve data about the pitch's layout without having issues with:
1) Quering JSON (available through PostgreSQL, but slow).
2) Joining other tables because we have a read-heavy system.

We achieve this by denormalizing the following fields and making sure they remain in-sync through application-level functionality and service-level modularization. Layout is the JSON field that defines how the grounds look within the canvas. This is an example of a layout value to enable usage by react-flow:

```
{
    grounds: [
        {
            id: "some-ground-cuid",
            type: "node",
            position: { x: 0, y: 0 },
            parentId: "some-combination-cuid",
            data: { name: "Ground A", size: "FIVE_A_SIDE" }
        },
        {
            id: "some-ground-cuid",
            type: "node",
            position: { x: 0, y: 100 },
            parentId: "some-combination-cuid",
            data: { name: "Ground B", size: "FIVE_A_SIDE" }
        },
    ],
    combinations: [
        {
            id: "some-combination-cuid",
            type: "group",
            position: { x: 0, y: 0 },
            data: { name: "Ground A + Ground B", size: "SEVEN_A_SIDE", type: "CONNECTED_PITCH" }
        }
    ]
}
```

groundCount, availableSports, availableSizes, and hasCombinations are all kept in-sync through application-level normalization with the Ground model and the layout field. Each of them are sets/unions that show easily queryable values.

```
layout          Json
groundCount     Int           @default(0)
availableSports GroundSport[]
availableSizes  GroundSize[]
hasCombinations Boolean       @default(false)
```

### Schedule & Pricing Metadata
We use the data we know about Grounds and create a union between all of the specific properties. This needs to be updated on every create, update, or delete operation with a transaction to ensure consistency and is enforced by modularization at the service-level.

```
minimumPrice Int
maximumPrice Int
earliestHour Int
latestHour   Int
openDays     Int[]
```

### Status Metadata
We do not need to introduce a submittedAt property. The optional properties are helper fields that can be used in the future and set through an admin panel. createdAt and updatedAt give us a good ballpark idea of the pitch's full lifecycle.

```
rejectionReason String?
approvedAt      DateTime?
verifiedBy      String?
createdAt       DateTime  @default(now())
updatedAt       DateTime  @updatedAt
```

## Ground
The ground acts as our smallest booking unit within the system. The schema has the following structure for the Ground model:

```
model Ground {
    id      String @id @default(cuid())
    pitchId String

    nameEn        String
    nameAr        String
    descriptionEn String?
    descriptionAr String?
    images        String[]
    sport         GroundSport
    surface       GroundSurface
    size          GroundSize

    status GroundStatus

    policy        GroundPolicy @default(STRICT)
    depositFee    Int?
    basePrice     Int
    peakPrice     Int?
    discountPrice Int?

    operatingHours Int[]
    peakHours      Int[]
    discountHours  Int[]

    pitch Pitch @relation(fields: [pitchId], references: [id], onDelete: Cascade)

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
}
```

### Name & Description
The following fields contain both languages as explained in the Pitch model. The images is an array of strings for ground-specific display. sport, surface, and size fields are both enums that allow an accurate description of every ground type across every sport within the pitch complex.

```
nameEn        String
nameAr        String
descriptionEn String?
descriptionAr String?
images        String[]
sport         GroundSport
surface       GroundSurface
size          GroundSize
```

### Status
The status field allows us to define a ground as either active, in-maintenance, or inactive. This is useful but needs to be handled carefully such that updating a ground does not make our pitch status inconsistent. If a pitch has no active grounds it can not be active itself. This needs to be handled at the service level.

```
status       GroundStatus
```

### Schedule
We need to be able to retrieve data about the ground's schedule without having issues with:
1) Quering JSON (available through PostgreSQL, but slow).
2) Joining other tables because we have a read-heavy system.

We achieve this by denormalizing the following fields and making sure they remain in-sync through application-level functionality and service-level modularization. We achieve this through using three 7 byte bitmask arrays that define our operatingHours, peakHours, and discountHours. This helps us reach CPU operation speeds without resorting to O(n) lookup on a 7x24 array, a JSON field which complexifies our querying or, even worse, having to deal with a separate Timeslot model with cron jobs to clean up and delete every set period of time.

```
operatingHours Int[]
peakHours      Int[]
discountHours  Int[]
```

### Price & Policy
We define our policy by 3 possible scenarios:
1) Don't confirm any cash bookings until manual approval - Strict.
2) Confirm the cash booking with a deposit first - Moderate.
3) Confirm the cash booking without a deposit - Lenient.

```
policy        GroundPolicy @default(STRICT)
depositFee    Int?
```

We also define our pricing rules to be used in coordination with the schedule values so we can return accurate pricing during queries to the frontend. peakPrice and discountPrice are kept optional to avoid having to make extra queries in case pricing isn't variable.

```
basePrice     Int
peakPrice     Int?
discountPrice Int?
```

## Staff
Staff is a "permissions relationship" table that joins a user and a pitch. The Staff model helps us define relationships and permissions for users across different pitches such that each pitch can have one owner and many different managers across different pitches. An owner can own multiple pitches or be an owner on one pitch and a manager on another. A user, however, can not have multiple roles on the same pitch. Actual operational permissions are defined through a JSON table with the following structure:

```
permissions: {
    bookings: "READ",
    payments: "WRITE",
    analytics: "NONE"
}
```

With space for expansion later. We give our fields READ, WRITE, and NONE values to define the specific permissions for that manager on this pitch. Owners will always have WRITE on every pitch subdomain.