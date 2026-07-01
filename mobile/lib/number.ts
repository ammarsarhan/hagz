import i18n from '@/i18next/i18next';

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
) {
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG';
  return new Intl.NumberFormat(locale, options).format(value);
}

export function convertNumerals(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
