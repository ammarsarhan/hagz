export function formatEnum(value: string) {
    const base = value.split("_");
    const label = base.map(item => `${item[0].toUpperCase()}${item.slice(1).toLowerCase()}`)
    return label.join(" ");
}