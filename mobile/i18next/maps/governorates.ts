import i18n from "@/i18next/i18next";

type GovernorateTranslation = { en: string; ar: string };

export const governorateTranslations: Record<string, GovernorateTranslation> = {
    "Alexandria":        { en: "Alexandria",        ar: "الإسكندرية" },
    "Aswan":             { en: "Aswan",             ar: "أسوان" },
    "Asyut":             { en: "Asyut",             ar: "أسيوط" },
    "Beheira":           { en: "Beheira",           ar: "البحيرة" },
    "Beni Suef":         { en: "Beni Suef",         ar: "بني سويف" },
    "Cairo":             { en: "Cairo",             ar: "القاهرة" },
    "Dakahlia":          { en: "Dakahlia",          ar: "الدقهلية" },
    "Damietta":          { en: "Damietta",          ar: "دمياط" },
    "Faiyum":            { en: "Faiyum",            ar: "الفيوم" },
    "Gharbia":           { en: "Gharbia",           ar: "الغربية" },
    "Giza":              { en: "Giza",              ar: "الجيزة" },
    "Ismailia":          { en: "Ismailia",          ar: "الإسماعيلية" },
    "Kafr El Sheikh":    { en: "Kafr El Sheikh",    ar: "كفر الشيخ" },
    "Luxor":             { en: "Luxor",             ar: "الأقصر" },
    "Matruh":            { en: "Matruh",            ar: "مطروح" },
    "Minya":             { en: "Minya",             ar: "المنيا" },
    "Monufia":           { en: "Monufia",           ar: "المنوفية" },
    "New Valley":        { en: "New Valley",        ar: "الوادي الجديد" },
    "North Sinai":       { en: "North Sinai",       ar: "شمال سيناء" },
    "Port Said":         { en: "Port Said",         ar: "بورسعيد" },
    "Qalyubia":          { en: "Qalyubia",          ar: "القليوبية" },
    "Qena":              { en: "Qena",              ar: "قنا" },
    "Red Sea":           { en: "Red Sea",           ar: "البحر الأحمر" },
    "Sharqia":           { en: "Sharqia",           ar: "الشرقية" },
    "Sohag":             { en: "Sohag",             ar: "سوهاج" },
    "South Sinai":       { en: "South Sinai",       ar: "جنوب سيناء" },
    "Suez":              { en: "Suez",              ar: "السويس" },
};

export function getDisplayGovernorate(key: string): string {
    const locale = i18n.language;
    return governorateTranslations[key]?.[locale as 'en' | 'ar'] ?? key;
}