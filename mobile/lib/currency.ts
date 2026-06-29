import i18n from "@/i18next/i18next";

export default function formatCurrency(value: number) {
    const format = i18n.language === "ar" ? "ar-EG" : "en-EG";

    const currency = new Intl.NumberFormat(format, {
        style: "currency",
        currency: "EGP",
    });

    return currency.format(value);
}