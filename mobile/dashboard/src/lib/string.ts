import * as z from "zod";

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

export default trim;