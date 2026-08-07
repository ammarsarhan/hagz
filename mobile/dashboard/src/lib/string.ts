import * as z from "zod";
import i18n from "@/i18next/i18next";

const trim = 
    (error: string) => z
        .string(error)
        .transform(s => s.trim());

export const formatPhone = (phone: string) => {
    const match = phone.match(/^(\+\d{2})(\d{3})(\d{3})(\d{4})$/);
    if (!match) return phone;
    const [, country, part1, part2, part3] = match;
    return `${country} ${part1} ${part2} ${part3}`;
};

export const parseEnum = (value: string) => {
    return value
        .toLowerCase()
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Formats a number as EGP currency using `Intl.NumberFormat`, localized via i18n.
 *
 * @param amount  - The numeric amount to format.
 * @param options.signDisplay - Controls sign rendering:
 *   `"auto"` (default) shows `-` for negatives only,
 *   `"always"` shows `+`/`-`,
 *   `"never"` strips signs,
 *   `"exceptZero"` shows `+`/`-` but nothing for 0.
 */
export const formatCurrency = (
    amount: number,
    options?: { signDisplay?: "auto" | "always" | "never" | "exceptZero" }
): string => {
    const locale = i18n.language === "ar" ? "ar-EG" : "en-EG";
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EGP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: options?.signDisplay ?? "auto",
    }).format(amount);
};

export default trim;