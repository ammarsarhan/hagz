"use client";

import type { AdminPayment } from "@hagz/contracts";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useCurrentBooking } from "@/admin/bookings/booking";
import { Code } from "@/admin/bookings/event-modal";
import { useBookingPayments } from "@/admin/bookings/history";
import { DataTable, Tag } from "@/admin/data-table";
import { Modal } from "@/admin/dialog";
import { formatMoney } from "@/admin/money";
import { DetailRow, PanelSection } from "@/admin/side-panel";
import { dateTime } from "@/admin/venues/history";

// A booking's Payments tab: what's due online and what's been paid, then every checkout the player
// started, oldest first, failed and replaced ones included, so support can see what they went
// through. Clicking a payment opens it in full, with its refunds.

const methodLabel = {
  CASH: "Cash",
  CARD: "Card",
  WALLET: "Wallet",
  REFERENCE: "Reference code",
  BNPL: "Pay later",
};
const statusLabel = {
  PENDING: "Pending",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  EXPIRED: "Replaced",
};
const refundLabel = { PENDING: "Pending", SUCCEEDED: "Refunded", FAILED: "Failed" };

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, AdminPayment>();

const columns = helper.columns([
  helper.display({
    id: "index",
    header: "#",
    cell: ({ row }) => <span className="text-ink-3 tabular-nums">{row.index + 1}</span>,
  }),
  helper.display({
    id: "method",
    header: "Method",
    cell: ({ row }) => <span className="text-ink">{methodLabel[row.original.method]}</span>,
  }),
  helper.display({
    id: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="text-ink-2 tabular-nums">
        {formatMoney(row.original.currency, row.original.amount)}
      </span>
    ),
  }),
  helper.display({
    id: "provider",
    header: "Provider",
    cell: ({ row }) =>
      row.original.provider ? (
        <span className="truncate text-ink-2">{row.original.provider}</span>
      ) : (
        <span className="text-ink-3">None</span>
      ),
  }),
  helper.display({
    id: "refunds",
    header: "Refunds",
    cell: ({ row }) =>
      row.original.refunds.length > 0 ? (
        <span className="text-ink-2">{row.original.refunds.length}</span>
      ) : (
        <span className="text-ink-3">None</span>
      ),
  }),
  helper.display({
    id: "created",
    header: "Started",
    cell: ({ row }) => (
      <span className="text-ink-2 tabular-nums">{dateTime(row.original.createdAt)}</span>
    ),
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Tag tone={row.original.status === "SUCCEEDED" ? "on" : "neutral"}>
        {statusLabel[row.original.status]}
      </Tag>
    ),
  }),
]);

// Method takes what's left.
const widths = {
  index: "3.5rem",
  amount: "9rem",
  provider: "9rem",
  refunds: "7rem",
  created: "12rem",
  status: "8rem",
};

export default function BookingPayments() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { booking } = useCurrentBooking();
  const { payments, error } = useBookingPayments(bookingId);
  const [opened, setOpened] = useState<AdminPayment>();

  const table = useTable({
    features,
    columns,
    data: payments ?? [],
    getRowId: (payment) => payment.id,
  });

  const due = booking
    ? booking.paymentMode === "MANUAL"
      ? null
      : (booking.deposit ?? booking.total)
    : undefined;

  return (
    <section>
      <h2 className="text-[1.25rem] leading-[1.625rem] font-semibold text-ink">Payments</h2>
      <p className="mt-1 text-body text-ink-2">
        {booking
          ? due === null
            ? "Paid at the venue: nothing is due online."
            : `${formatMoney(booking.currency, due ?? 0)} due online, ${formatMoney(booking.currency, booking.paid)} paid.`
          : " "}
      </p>

      <div className="mt-8">
        <DataTable
          table={table}
          widths={widths}
          onRowClick={(row) => setOpened(row.original)}
          loading={!payments && !error}
          empty={error ?? "No payments for this booking."}
        />
      </div>
      {opened ? <PaymentModal payment={opened} onClose={() => setOpened(undefined)} /> : null}
    </section>
  );
}

function PaymentModal({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const money = (minor: number) => formatMoney(payment.currency, minor);
  const none = <span className="text-ink-3">None</span>;
  return (
    <Modal
      onClose={onClose}
      title={`${methodLabel[payment.method]} · ${money(payment.amount)}`}
      description={dateTime(payment.createdAt)}
    >
      <div className="flex flex-col gap-6">
        <PanelSection title="Payment">
          <div>
            <DetailRow label="Status" value={statusLabel[payment.status]} />
            <DetailRow
              label="Succeeded"
              value={payment.succeededAt ? dateTime(payment.succeededAt) : none}
            />
            <DetailRow label="Payment ID" value={<Code>{payment.id}</Code>} />
            {payment.recorder ? (
              <DetailRow label="Recorded by" value={payment.recorder.name} />
            ) : null}
          </div>
        </PanelSection>

        <PanelSection title="Provider">
          <div>
            <DetailRow label="Name" value={payment.provider ?? none} />
            <DetailRow
              label="Reference"
              value={payment.providerReference ? <Code>{payment.providerReference}</Code> : none}
            />
            <DetailRow label="Brand" value={payment.brand ?? none} />
            <DetailRow
              label="Fee"
              value={payment.providerFee === null ? none : money(payment.providerFee)}
            />
          </div>
        </PanelSection>

        <PanelSection title="Refunds">
          {payment.refunds.length === 0 ? (
            <p className="text-label text-ink-3">Nothing refunded.</p>
          ) : (
            <div>
              {payment.refunds.map((refund) => (
                <DetailRow
                  key={refund.id}
                  label={`${refundLabel[refund.status]} · ${dateTime(refund.createdAt)}`}
                  value={money(refund.amount)}
                />
              ))}
            </div>
          )}
        </PanelSection>
      </div>
    </Modal>
  );
}
