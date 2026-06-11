export default function formatCurrency(amount: number, options = {}) {
    return new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: "EGP",
        maximumFractionDigits: 2,
        ...options,
    }).format(amount);
}