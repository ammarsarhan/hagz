export default function formatCurrency(value: number) {
    const currency = new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: "EGP",
    });

    currency.format(value);
}