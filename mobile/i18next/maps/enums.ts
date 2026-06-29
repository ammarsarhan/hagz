import i18n from "@/i18next/i18next";

type EnumTranslation = { en: string; ar: string };
type Locale = "en" | "ar";

function getDisplay(map: Record<string, EnumTranslation>, key: string): string {
    const locale = i18n.language as Locale;
    return map[key]?.[locale] ?? key;
}

export const userStatusTranslations: Record<string, EnumTranslation> = {
    ACTIVE: { en: "Active", ar: "نشط" },
    SUSPENDED: { en: "Suspended", ar: "موقوف" },
    BANNED: { en: "Banned", ar: "محظور" },
    DELETED: { en: "Deleted", ar: "محذوف" },
};

export const userRoleTranslations: Record<string, EnumTranslation> = {
    USER: { en: "User", ar: "مستخدم" },
    STAFF: { en: "Staff", ar: "موظف" },
};

export const staffRoleTranslations: Record<string, EnumTranslation> = {
    MANAGER: { en: "Manager", ar: "مدير" },
    OWNER: { en: "Owner", ar: "مالك" },
};

export const getDisplayUserStatus = (k: string) => getDisplay(userStatusTranslations, k);
export const getDisplayUserRole = (k: string) => getDisplay(userRoleTranslations, k);
export const getDisplayStaffRole = (k: string) => getDisplay(staffRoleTranslations, k);

export const amenityNameTranslations: Record<string, EnumTranslation> = {
    LIGHTING: { en: "Lighting", ar: "إضاءة" },
    SEATING: { en: "Seating", ar: "مقاعد" },
    LOCKER_ROOMS: { en: "Locker Rooms", ar: "غرف تبديل الملابس" },
    SHOWERS: { en: "Showers", ar: "دشات" },
    TOILETS: { en: "Toilets", ar: "دورات مياه" },
    PARKING: { en: "Parking", ar: "موقف سيارات" },
    AIR_CONDITIONED: { en: "Air Conditioned", ar: "تكييف هواء" },
    HEATING: { en: "Heating", ar: "تدفئة" },
    SOUND_SYSTEM: { en: "Sound System", ar: "نظام صوتي" },
    WATER_FOUNTAIN: { en: "Water Fountain", ar: "نافورة مياه" },
    WIFI: { en: "Wi-Fi", ar: "واي فاي" },
    BALL_INCLUDED: { en: "Ball Included", ar: "كرة مشمولة" },
    EQUIPMENT_RENTAL: { en: "Equipment Rental", ar: "تأجير معدات" },
    FIRST_AID: { en: "First Aid", ar: "إسعافات أولية" },
    REFEREE_SERVICE: { en: "Referee Service", ar: "خدمة حكم" },
    CAFETERIA: { en: "Cafeteria", ar: "كافيتيريا" },
};

export const amenityPriceTranslations: Record<string, EnumTranslation> = {
    PER_HOUR: { en: "Per Hour", ar: "لكل ساعة" },
    PER_BOOKING: { en: "Per Booking", ar: "لكل حجز" },
};

export const getDisplayAmenityName = (k: string) => getDisplay(amenityNameTranslations, k);
export const getDisplayAmenityPrice = (k: string) => getDisplay(amenityPriceTranslations, k);

export const bookingStatusTranslations: Record<string, EnumTranslation> = {
    RESERVED: { en: "Reserved", ar: "محجوز" },
    CONFIRMED: { en: "Confirmed", ar: "مؤكد" },
    EXPIRED: { en: "Expired", ar: "منتهي" },
    CANCELLED: { en: "Cancelled", ar: "ملغي" },
    RESCHEDULED: { en: "Rescheduled", ar: "مُعاد جدولته" },
    IN_PROGRESS: { en: "In Progress", ar: "جارٍ" },
    NO_SHOW: { en: "No Show", ar: "لم يحضر" },
    COMPLETED: { en: "Completed", ar: "مكتمل" },
};

export const bookingChannelTranslations: Record<string, EnumTranslation> = {
    ONLINE: { en: "Online", ar: "إلكتروني" },
    WALK_IN: { en: "Walk-in", ar: "حضوري" },
};

export const getDisplayBookingStatus = (k: string) => getDisplay(bookingStatusTranslations, k);
export const getDisplayBookingChannel = (k: string) => getDisplay(bookingChannelTranslations, k);

export const pitchTierTranslations: Record<string, EnumTranslation> = {
    ALPHA: { en: "Alpha", ar: "ألفا" },
    BETA: { en: "Beta", ar: "بيتا" },
    STANDARD: { en: "Standard", ar: "قياسي" },
    PREMIUM: { en: "Premium", ar: "مميز" },
};

export const pitchStatusTranslations: Record<string, EnumTranslation> = {
    DRAFT: { en: "Draft", ar: "مسودة" },
    SUBMITTED: { en: "Submitted", ar: "مقدّم" },
    ACCEPTED: { en: "Accepted", ar: "مقبول" },
    REJECTED: { en: "Rejected", ar: "مرفوض" },
    LIVE: { en: "Live", ar: "منشور" },
    MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    DELETED: { en: "Deleted", ar: "محذوف" },
};

export const getDisplayPitchTier = (k: string) => getDisplay(pitchTierTranslations, k);
export const getDisplayPitchStatus = (k: string) => getDisplay(pitchStatusTranslations, k);

export const groundStatusTranslations: Record<string, EnumTranslation> = {
    ACTIVE: { en: "Active", ar: "نشط" },
    MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    DELETED: { en: "Deleted", ar: "محذوف" },
};

export const groundSurfaceTranslations: Record<string, EnumTranslation> = {
    NATURAL_GRASS: { en: "Natural Grass", ar: "عشب طبيعي" },
    ARTIFICIAL_TURF: { en: "Artificial Turf", ar: "عشب صناعي" },
    HARD_WOOD: { en: "Hard Wood", ar: "خشب صلب" },
    OTHER: { en: "Other", ar: "أخرى" },
};

export const groundSportTranslations: Record<string, EnumTranslation> = {
    FOOTBALL: { en: "Football", ar: "كرة قدم" },
    BASKETBALL: { en: "Basketball", ar: "كرة سلة" },
    PADEL: { en: "Padel", ar: "بادل" },
    TENNIS: { en: "Tennis", ar: "تنس" },
    VOLLEYBALL: { en: "Volleyball", ar: "كرة طائرة" },
};

export const groundSizeTranslations: Record<string, EnumTranslation> = {
    FIVE_A_SIDE: { en: "5-a-side", ar: "خماسي" },
    SEVEN_A_SIDE: { en: "7-a-side", ar: "سباعي" },
    ELEVEN_A_SIDE: { en: "11-a-side", ar: "حادي عشر" },
    STANDARD: { en: "Standard", ar: "قياسي" },
};

export const getDisplayGroundStatus = (k: string) => getDisplay(groundStatusTranslations, k);
export const getDisplayGroundSurface = (k: string) => getDisplay(groundSurfaceTranslations, k);
export const getDisplayGroundSport = (k: string) => getDisplay(groundSportTranslations, k);
export const getDisplayGroundSize = (k: string) => getDisplay(groundSizeTranslations, k);

export const slotStatusTranslations: Record<string, EnumTranslation> = {
    AVAILABLE: { en: "Available", ar: "متاح" },
    BOOKED: { en: "Booked", ar: "محجوز" },
    INACTIVE: { en: "Inactive", ar: "غير نشط" },
};

export const priceTypeTranslations: Record<string, EnumTranslation> = {
    BASE: { en: "Base", ar: "أساسي" },
    PEAK: { en: "Peak", ar: "ذروة" },
    DISCOUNT: { en: "Discount", ar: "خصم" },
};

export const getDisplaySlotStatus = (k: string) => getDisplay(slotStatusTranslations, k);
export const getDisplayPriceType = (k: string) => getDisplay(priceTypeTranslations, k);

export const paymentMethodTranslations: Record<string, EnumTranslation> = {
    CASH: { en: "Cash", ar: "نقدي" },
    CARD: { en: "Card", ar: "بطاقة" },
    WALLET: { en: "Wallet", ar: "محفظة" },
};

export const payoutTriggerTranslations: Record<string, EnumTranslation> = {
    MANUAL: { en: "Manual", ar: "يدوي" },
    SCHEDULED: { en: "Scheduled", ar: "مجدوَل" },
};

export const payoutMethodTranslations: Record<string, EnumTranslation> = {
    BANK_TRANSFER: { en: "Bank Transfer", ar: "تحويل بنكي" },
    WALLET: { en: "Wallet", ar: "محفظة" },
    MANUAL: { en: "Manual", ar: "يدوي" },
};

export const payoutStatusTranslations: Record<string, EnumTranslation> = {
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    PROCESSING: { en: "Processing", ar: "قيد المعالجة" },
    COMPLETED: { en: "Completed", ar: "مكتمل" },
    FAILED: { en: "Failed", ar: "فشل" },
};

export const refundStatusTranslations: Record<string, EnumTranslation> = {
    NOT_APPLICABLE: { en: "Not Applicable", ar: "غير منطبق" },
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    PROCESSED: { en: "Processed", ar: "تمت المعالجة" },
    FORFEITED: { en: "Forfeited", ar: "مُصادَر" },
};

export const ledgerActionTranslations: Record<string, EnumTranslation> = {
    BOOKING_REVENUE: { en: "Booking Revenue", ar: "إيراد الحجز" },
    PLATFORM_FEE_DEBIT: { en: "Platform Fee Debit", ar: "خصم رسوم المنصة" },
    SERVICE_FEE_CREDIT: { en: "Service Fee Credit", ar: "إيداع رسوم الخدمة" },
    CASH_FEE_DEBT: { en: "Cash Fee Debt", ar: "دين رسوم نقدي" },
    PAYOUT: { en: "Payout", ar: "صرف" },
    PAYOUT_REVERSAL: { en: "Payout Reversal", ar: "استرداد صرف" },
    ADJUSTMENT: { en: "Adjustment", ar: "تسوية" },
};

export const recurringPaymentScheduleTranslations: Record<string, EnumTranslation> = {
    UPFRONT: { en: "Upfront", ar: "مقدمًا" },
    PER_BOOKING: { en: "Per Booking", ar: "لكل حجز" },
};

export const getDisplayPaymentMethod = (k: string) => getDisplay(paymentMethodTranslations, k);
export const getDisplayPayoutTrigger = (k: string) => getDisplay(payoutTriggerTranslations, k);
export const getDisplayPayoutMethod = (k: string) => getDisplay(payoutMethodTranslations, k);
export const getDisplayPayoutStatus = (k: string) => getDisplay(payoutStatusTranslations, k);
export const getDisplayRefundStatus = (k: string) => getDisplay(refundStatusTranslations, k);
export const getDisplayLedgerAction = (k: string) => getDisplay(ledgerActionTranslations, k);
export const getDisplayRecurringPayment = (k: string) => getDisplay(recurringPaymentScheduleTranslations, k);

export const mediaTypeTranslations: Record<string, EnumTranslation> = {
    IMAGE: { en: "Image", ar: "صورة" },
    VIDEO: { en: "Video", ar: "فيديو" },
};

export const mediaStatusTranslations: Record<string, EnumTranslation> = {
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    UPLOADED: { en: "Uploaded", ar: "تم الرفع" },
    DELETED: { en: "Deleted", ar: "محذوف" },
};

export const getDisplayMediaType = (k: string) => getDisplay(mediaTypeTranslations, k);
export const getDisplayMediaStatus = (k: string) => getDisplay(mediaStatusTranslations, k);

export const scheduleStatusTranslations: Record<string, EnumTranslation> = {
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    GENERATING: { en: "Generating", ar: "جارٍ الإنشاء" },
    READY: { en: "Ready", ar: "جاهز" },
    FAILED: { en: "Failed", ar: "فشل" },
};

export const getDisplayScheduleStatus = (k: string) => getDisplay(scheduleStatusTranslations, k);

export const notificationChannelTranslations: Record<string, EnumTranslation> = {
    IN_APP: { en: "In-App", ar: "داخل التطبيق" },
    PUSH: { en: "Push", ar: "إشعار فوري" },
    WHATSAPP: { en: "WhatsApp", ar: "واتساب" },
    EMAIL: { en: "Email", ar: "بريد إلكتروني" },
};

export const notificationEventTranslations: Record<string, EnumTranslation> = {
    BOOKING_RESERVED: { en: "Booking Reserved", ar: "تم الحجز" },
    BOOKING_CONFIRMED: { en: "Booking Confirmed", ar: "تم تأكيد الحجز" },
    BOOKING_CANCELLED: { en: "Booking Cancelled", ar: "تم إلغاء الحجز" },
    BOOKING_RESCHEDULED: { en: "Booking Rescheduled", ar: "تمت إعادة جدولة الحجز" },
    BOOKING_REMINDER: { en: "Booking Reminder", ar: "تذكير بالحجز" },
    BOOKING_STARTED: { en: "Booking Started", ar: "بدأ الحجز" },
    BOOKING_EXPIRED: { en: "Booking Expired", ar: "انتهى الحجز" },
    BOOKING_NO_SHOW: { en: "No Show", ar: "لم يحضر" },
    BOOKING_RECEIVED: { en: "Booking Received", ar: "تم استقبال حجز" },
    BOOKING_UPDATED: { en: "Booking Updated", ar: "تم تحديث الحجز" },
    PAYOUT_PROCESSED: { en: "Payout Processed", ar: "تمت معالجة الصرف" },
    PAYOUT_FAILED: { en: "Payout Failed", ar: "فشل الصرف" },
    INVITATION_CREATED: { en: "Invitation Created", ar: "تم إنشاء الدعوة" },
    INVITATION_RECEIVED: { en: "Invitation Received", ar: "تم استقبال الدعوة" },
    INVITATION_ACCEPTED: { en: "Invitation Accepted", ar: "تم قبول الدعوة" },
    PITCH_UPDATED: { en: "Pitch Updated", ar: "تم تحديث الملعب" },
};

export const notificationStatusTranslations: Record<string, EnumTranslation> = {
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    SENT: { en: "Sent", ar: "تم الإرسال" },
    FAILED: { en: "Failed", ar: "فشل" },
    SKIPPED: { en: "Skipped", ar: "تم التخطي" },
};

export const getDisplayNotifChannel = (k: string) => getDisplay(notificationChannelTranslations, k);
export const getDisplayNotifEvent = (k: string) => getDisplay(notificationEventTranslations, k);
export const getDisplayNotifStatus = (k: string) => getDisplay(notificationStatusTranslations, k);

export const invitationStatusTranslations: Record<string, EnumTranslation> = {
    PENDING: { en: "Pending", ar: "قيد الانتظار" },
    EXPIRED: { en: "Expired", ar: "منتهي" },
    ACCEPTED: { en: "Accepted", ar: "مقبول" },
    REJECTED: { en: "Rejected", ar: "مرفوض" },
    DELETED: { en: "Deleted", ar: "محذوف" },
};

export const getDisplayInvitationStatus = (k: string) => getDisplay(invitationStatusTranslations, k);

export const permissionLevelTranslations: Record<string, EnumTranslation> = {
    NONE: { en: "None", ar: "بدون" },
    READ: { en: "Read", ar: "قراءة" },
    WRITE: { en: "Write", ar: "كتابة" },
};

export const getDisplayPermissionLevel = (k: string) => getDisplay(permissionLevelTranslations, k);