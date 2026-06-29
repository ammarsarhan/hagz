import { Language } from '@/generated/prisma/enums.js';

export const pitchI18n = {
    [Language.EN]: {
        feed: {
            general: {
                featured: { title: "Featured", description: "Hand-picked pitches we think you'll love.", badge: "Featured" },
                hot: { title: "Hot This Week", description: "The most booked pitches this week." },
                topRated: { title: "Top Rated", description: null },
                budget: { title: "Budget Friendly", description: "Great value between EGP 150-250." },
                instant: { title: "Instant Booking", description: "Book instantly without waiting." },
                premium: { title: "Premium", description: null, badge: "Premium" },
            },
            personalized: {
                recents: { title: "Recent", description: "Based on your previous bookings" },
                nearby: { title: "Nearby", description: "Within 25 km of your location" },
            }
        }
    },
    [Language.AR]: {
        feed: {
            general: {
                featured: { title: "مختارة", description: "ملاعب مختارة بعناية ستعجبك.", badge: "مميز" },
                hot: { title: "الأكثر حجزاً", description: "الملاعب الأكثر حجزاً هذا الأسبوع." },
                topRated: { title: "الأعلى تقييماً", description: null },
                budget: { title: "اقتصادية", description: "قيمة ممتازة بين ١٥٠-٢٥٠ جنيه." },
                instant: { title: "حجز فوري", description: "احجز فوراً بدون انتظار." },
                premium: { title: "بريميوم", description: null, badge: "بريميوم" },
            },
            personalized: {
                recents: { title: "حجوزاتك السابقة", description: "بناءً على حجوزاتك السابقة" },
                nearby: { title: "بالقرب منك", description: "في نطاق ٢٥ كم من موقعك" },
            }
        }
    },
} as const;
