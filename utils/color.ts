const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

export const colors = {
    "blue": shades.map(s => `bg-blue-${s}`),
    "emerald": shades.map(s => `bg-emerald-${s}`),
    "slate": shades.map(s => `bg-slate-${s}`),
}

export const safelist = [...colors.blue, ...colors.emerald, ...colors.slate]
