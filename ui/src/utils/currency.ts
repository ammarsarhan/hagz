export default function getCurrencyString(value: number) {
    return value.toLocaleString("en-US", { style: "currency", currency: "EGP" });
}