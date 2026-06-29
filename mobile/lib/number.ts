import i18n from "@/i18next/i18next";

export default function formatNumber(value: number, options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 }) {
    const locale = i18n.language === "ar" ? "ar-EG" : "en-EG";
    return new Intl.NumberFormat(locale, options).format(value);
};
