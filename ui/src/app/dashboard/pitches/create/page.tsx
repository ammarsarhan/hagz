import { QueryClient } from '@tanstack/react-query';

import ProviderWrapper from "@/app/dashboard/pitches/create/ProviderWrapper";
import { fetchPitchCreateState } from '@/app/utils/api/server';
import { PitchType } from '@/app/utils/types/pitch';
import ErrorView from '@/app/components/base/Error';

export default async function Create() {
    const query = new QueryClient();

    const { data } = await query.fetchQuery({
        queryKey: ["dashboard", "pitches", 'create'],
        queryFn: fetchPitchCreateState
    });

    const draft = data.pitches.find((pitch: PitchType) => pitch.status === "DRAFT");

    // If the owner has a pending pitch, do not render the form at all
    if (data.isPending) {
        return (
            <ErrorView title="Your already have a pitch under review." message="Please wait while we process your pitch. Until then you may not create more pitches. If you have any questions, feel free to contact us."/>
        )
    };

    // If the owner has a draft pitch, render the form at stepIndex = step.index
    // If the owner does not have any current pitches, and the stage is null, render the form with the stepIndex at 0
    // If the owner has pitches, and wants to create a draft, render the form with the stepIndex at 0

    if (data.step && draft) {
        const index = data.step.index + 1;
        return <ProviderWrapper draft={draft} index={index}/>
    };
    
    return <ProviderWrapper/>
}

// The user can have no pitches at all, so this is their first time creating a draft.
// It would be counter-intuitive to show a list of existing drafts or a create or edit option.
// In that case we just go directly to the draft.
// This means that we need a context and a function to take us directly to the part that was last edited by the user.

// Now what if we already have a pitch that is pending, we should show the user that pitch's details and don't allow editing, just notify them that it it still being edited.

// If there are pitches, that aren't drafts or pending, we should allow the user to go into a new draft.

// A draft only happens after sending a POST request on the first next() call
