"use client";

import type { JobsStatus, QueueName } from "@hagz/contracts";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/admin/api";
import { Button } from "@/admin/button";
import { message, notTheirFault, send } from "@/admin/errors";
import { useHud } from "@/admin/hud";
import { Section, ShareTable } from "./blocks";
import { ago, clock } from "./model";

// Home's Jobs card (PR 2.6): every background queue, when slot generation's nightly runs and checks
// last finished, and the jobs that failed on their last attempt, each with Retry.

const QUEUE_LABEL: Record<QueueName, string> = {
  "slot-generation": "Slot generation",
  "slot-maintenance": "Slot upkeep",
  "venue-photo-sweeper": "Photo cleanup",
  "customer-avatar-sweeper": "Avatar cleanup",
};

export function useJobs() {
  const [jobs, setJobs] = useState<JobsStatus>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const result = await send(api.GET("/v1/admin/jobs"));
    if (!result.ok) {
      setError(message(result.error));
      return;
    }
    setError(undefined);
    setJobs(result.data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { jobs, error, reload: load };
}

const count = (value: number, strong = false) => (
  <span className={`tabular-nums ${strong && value > 0 ? "font-semibold text-ink" : ""}`}>
    {value.toLocaleString("en")}
  </span>
);

export function JobsSections({
  jobs,
  error,
  now,
  reload,
}: {
  jobs?: JobsStatus;
  error?: string;
  now: number;
  reload: () => Promise<void>;
}) {
  const hud = useHud();
  const [retrying, setRetrying] = useState<string>();
  const last = (at: string | null) => (at ? ago(at, now) : "not yet");

  const retry = async (queue: QueueName, jobId: string) => {
    setRetrying(jobId);
    const result = await send(
      api.POST("/v1/admin/jobs/{queue}/{jobId}/retry", { params: { path: { queue, jobId } } }),
    );
    setRetrying(undefined);
    if (!result.ok) {
      hud(
        message(result.error),
        notTheirFault(result.error)
          ? { label: "Try again", run: () => void retry(queue, jobId) }
          : undefined,
      );
      return;
    }
    await reload();
  };

  return (
    <>
      <Section
        title="Jobs"
        description={
          jobs
            ? `Slots rolled forward ${last(jobs.lastRuns.rollForward)}, audited ${last(jobs.lastRuns.audit)}, checked ${last(jobs.lastRuns.checks)}.`
            : (error ?? "Every background queue right now.")
        }
      >
        <ShareTable
          columns={[
            { label: "Queue" },
            { label: "Waiting", align: "right", width: "4.5rem" },
            { label: "Active", align: "right", width: "4rem" },
            { label: "Delayed", align: "right", width: "4.5rem" },
            { label: "Failed", align: "right", width: "4rem" },
            { label: "Oldest waiting", align: "right", width: "7.5rem" },
          ]}
          empty={error ? "Couldn't read the queues." : "Loading…"}
          rows={(jobs?.queues ?? []).map((queue) => ({
            key: queue.name,
            cells: [
              QUEUE_LABEL[queue.name],
              count(queue.waiting),
              count(queue.active),
              count(queue.delayed),
              count(queue.failed, true),
              <span key="o" className="tabular-nums">
                {queue.oldestWaitingAt ? ago(queue.oldestWaitingAt, now) : "—"}
              </span>,
            ],
          }))}
        />
      </Section>

      <Section
        title="Failed jobs"
        description="Jobs that failed on their last attempt. Retry runs one again from the start."
      >
        <ShareTable
          columns={[
            { label: "Job" },
            { label: "Why" },
            { label: "Failed", width: "7.5rem" },
            { label: "", align: "right", width: "5.5rem" },
          ]}
          empty="No failed jobs."
          rows={(jobs?.failed ?? []).map((job) => ({
            key: `${job.queue}-${job.id}`,
            cells: [
              <span key="j" title={job.groundId ? `Ground ${job.groundId}` : job.id}>
                {QUEUE_LABEL[job.queue]}
              </span>,
              <span key="w" title={job.reason}>
                {job.reason}
              </span>,
              job.failedAt ? clock.format(new Date(job.failedAt)) : "—",
              <Button
                key="r"
                size="small"
                variant="secondary"
                loading={retrying === job.id}
                onClick={() => void retry(job.queue, job.id)}
              >
                Retry
              </Button>,
            ],
          }))}
        />
      </Section>
    </>
  );
}
