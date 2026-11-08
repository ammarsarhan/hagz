"use client";

import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { send } from "@/admin/errors";
import { PageHeader } from "@/admin/page-header";
import {
  AmenityDialog,
  DeleteDialog,
  LocationDialog,
  MarketplaceDialog,
} from "@/admin/platform/forms";
import { usePlatform } from "@/admin/platform/model";

// Platform: marketplaces, with each one's location tree and amenity catalog.
// The locations and amenities view is waiting on its design; the data is in usePlatform().
export default function AdminPlatform() {
  const { error, open, actions, close, reload } = usePlatform();

  return (
    <>
      <PageHeader
        title="Platform"
        subtitle="Marketplaces, their locations and the amenities venues can offer."
        actions={
          <div className="w-48">
            <Button onClick={actions.addMarketplace}>Add marketplace</Button>
          </div>
        }
      />

      {error ? (
        <p role="alert" className="mt-6 rounded-field bg-red/10 px-4 py-3 text-label text-red">
          {error}
        </p>
      ) : null}

      {/* Adding a marketplace moves to a side panel, waiting on its design; editing stays a dialog. */}
      {open?.form === "marketplace" && open.marketplace ? (
        <MarketplaceDialog marketplace={open.marketplace} onClose={close} onDone={reload} />
      ) : null}
      {open?.form === "location" ? (
        <LocationDialog
          marketplace={open.marketplace}
          parent={open.parent}
          location={open.location}
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "amenity" ? (
        <AmenityDialog
          marketplace={open.marketplace}
          amenity={open.amenity}
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "deleteLocation" ? (
        <DeleteDialog
          title={`Delete ${open.location.names.en}?`}
          description="Only possible while it has no locations under it and no venues in it."
          request={() =>
            send(
              api.DELETE("/v1/admin/locations/{id}", {
                params: { path: { id: open.location.id } },
              }),
            )
          }
          onClose={close}
          onDone={reload}
        />
      ) : null}
      {open?.form === "deleteAmenity" ? (
        <DeleteDialog
          title={`Delete ${open.amenity.names.en}?`}
          description="Only possible while no venue offers it. Otherwise turn it off."
          request={() =>
            send(
              api.DELETE("/v1/admin/amenities/{id}", {
                params: { path: { id: open.amenity.id } },
              }),
            )
          }
          onClose={close}
          onDone={reload}
        />
      ) : null}
    </>
  );
}
