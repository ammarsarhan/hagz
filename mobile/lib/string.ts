export function parseCamelCase(key: string): string {
    const text = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .trim();

    return text.charAt(0).toUpperCase() + text.slice(1);
}