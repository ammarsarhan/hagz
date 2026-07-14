import { useStore } from '@tanstack/react-form';
import type { AnyFormApi } from '@tanstack/react-form';

export function useIsDirty(form: AnyFormApi): boolean {
    return useStore(form.store, (state) =>
        Object.values(state.fieldMeta).some(
            (meta) => meta && !meta.isDefaultValue
        )
    );
}