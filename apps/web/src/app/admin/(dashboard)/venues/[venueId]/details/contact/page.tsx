"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton, Tag } from "@/admin/data-table";
import { useVenueContact } from "@/admin/venues/contact";
import { dateTime } from "@/admin/venues/history";
import { TaxCheckDialog } from "@/admin/venues/tax-check-dialog";
import { DetailsBlock, DetailsRow } from "@/admin/venues/details-block";
import { useCurrentVenue } from "@/admin/venues/venue";

// A venue's phone and tax number, laid out like its other sections: the phone players call, then
// the tax number with its latest check. The owner sets both in the staff app. While the venue is
// provisioning, Check records whether the number is real (the Application tab's check, which the API
// only takes then).
export default function VenueContact() {
  const { venueId } = useParams<{ venueId: string }>();
  const { venue } = useCurrentVenue();
  const { data, error, reload } = useVenueContact(venueId);
  const [checking, setChecking] = useState(false);
  const canCheck = venue?.status === "PROVISIONING" && Boolean(data?.taxNumber.value);
  const check = data?.taxNumber.check;

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Contact and tax</h2>
      <p className="mt-1 text-body text-ink-2">
        The phone players call, and the tax number Hagz checks before the venue goes live.
      </p>

      {error && !data ? (
        <p className="mt-8 text-body text-ink-2">{error}</p>
      ) : (
        <>
          <DetailsBlock title="Contact">
            <DetailsRow label="Phone">
              {!data ? (
                <Skeleton className="h-4 w-36" />
              ) : data.phone ? (
                <span className="text-body text-ink tabular-nums">{data.phone}</span>
              ) : (
                <span className="text-body text-ink-3">None</span>
              )}
            </DetailsRow>
          </DetailsBlock>

          <DetailsBlock
            title="Tax number"
            action={
              canCheck ? (
                <button
                  type="button"
                  onClick={() => setChecking(true)}
                  className="shrink-0 cursor-pointer text-label font-semibold text-ink underline underline-offset-4 hover:opacity-70"
                >
                  {check ? "Check again" : "Check"}
                </button>
              ) : null
            }
          >
            <DetailsRow label="Number">
              {!data ? (
                <Skeleton className="h-4 w-28" />
              ) : data.taxNumber.value ? (
                <span className="text-body text-ink tabular-nums">{data.taxNumber.value}</span>
              ) : (
                <span className="text-body text-ink-3">
                  None. Only needed if the venue charges VAT.
                </span>
              )}
            </DetailsRow>
            {data?.taxNumber.value ? (
              <DetailsRow label="Check">
                {check ? (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Tag tone={check.valid ? "on" : "neutral"}>
                        {check.valid ? "Valid" : "Not valid"}
                      </Tag>
                      <span className="text-label text-ink-2">{dateTime(check.at)}</span>
                    </span>
                    {check.note ? (
                      <p className="mt-1.5 text-body text-ink-2">{check.note}</p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-body text-ink-3">Not checked yet</span>
                )}
              </DetailsRow>
            ) : null}
          </DetailsBlock>
        </>
      )}

      {checking && data?.taxNumber.value ? (
        <TaxCheckDialog
          venueId={venueId}
          taxNumber={data.taxNumber.value}
          onClose={() => setChecking(false)}
          onDone={reload}
        />
      ) : null}
    </section>
  );
}
