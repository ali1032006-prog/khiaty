export function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function when(d: Date) {
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  AWARDED: "Awarded",
  CLOSED: "Closed",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  SUPERSEDED: "Not selected",
  PAID: "Paid",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
};
