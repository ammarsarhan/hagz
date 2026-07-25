import * as z from 'zod';
import trim from '@/lib/string';

export const detailsSchema = z.object({
  name: trim('Pitch name is required.')
    .pipe(
      z.string()
        .min(2, 'Pitch name must be at least 2 characters.')
        .max(100, 'Pitch name may not exceed 100 characters.'),
    ),
  description: trim('Pitch description is required.')
    .pipe(
      z.string().refine(
        (val) => {
          const words = val.split(/\s+/).filter(Boolean);
          return words.length >= 5 && words.length <= 200;
        },
        'Pitch description must be between 5 and 200 words.'
      )
    ),
  taxId: z.string()
    .length(9, 'Tax ID must be exactly 9 characters.')
    .regex(/^\d+$/, 'Tax ID must contain numbers only.')
    .nullish()
    .or(z.literal('')),
});

export function isDetailsComplete(state: any): boolean {
  return detailsSchema.safeParse(state).success;
}
