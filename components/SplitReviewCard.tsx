"use client";

import { SplitEntry, RequestStatus } from "@/types";

const AVATAR_COLORS = [
  "from-purple-500 to-blue-500",
  "from-blue-500 to-cyan-400",
  "from-cyan-400 to-emerald-400",
  "from-pink-500 to-purple-500",
  "from-orange-400 to-pink-500",
];

function Avatar({ name, index }: { name: string; index: number }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const gradient = AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <div
      className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm shadow-lg flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus["status"] }) {
  const config = {
    pending: { label: "Pending", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    sent: { label: "Sent ✓", cls: "bg-bunq-green/20 text-bunq-green border-bunq-green/30" },
    mock: { label: "Demo Sent ✓", cls: "bg-bunq-blue/20 text-bunq-blue border-bunq-blue/30" },
    failed: { label: "Failed", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = config[status];
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  );
}

interface SplitReviewCardProps {
  split: SplitEntry;
  index: number;
  currency: string;
  requestStatus?: RequestStatus;
  matchedEmail?: string;
}

export function SplitReviewCard({
  split,
  index,
  currency,
  requestStatus,
  matchedEmail,
}: SplitReviewCardProps) {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";

  return (
    <div className="relative group rounded-2xl bg-bunq-card border border-bunq-border hover:border-bunq-purple/40 transition-all duration-300 overflow-hidden">
      {/* Gradient top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${
            ["#7B4FFF", "#00AEFF", "#00E5A0", "#FF4F9A", "#FF9900"][index % 5]
          }, transparent)`,
        }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={split.name} index={index} />
            <div>
              <h3 className="text-white font-semibold text-lg leading-tight">{split.name}</h3>
              {matchedEmail ? (
                <p className="text-bunq-purple/70 text-xs mt-0.5 truncate">{matchedEmail}</p>
              ) : (
                <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{split.justification}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {symbol}{split.amount_owed.toFixed(2)}
            </div>
            {requestStatus && (
              <div className="mt-1">
                <StatusBadge status={requestStatus.status} />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        {split.items && split.items.length > 0 && (
          <div className="space-y-1.5 mt-3 pt-3 border-t border-bunq-border">
            {split.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <div className="w-1 h-1 rounded-full bg-bunq-blue/60 flex-shrink-0" />
                <span className="text-gray-400">{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {requestStatus?.status === "failed" && requestStatus.error && (
          <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            {requestStatus.error}
          </p>
        )}
      </div>
    </div>
  );
}

export function SplitCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bunq-card border border-bunq-border overflow-hidden animate-pulse">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bunq-border" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-bunq-border rounded" />
              <div className="h-3 w-40 bg-bunq-border/60 rounded" />
            </div>
          </div>
          <div className="h-7 w-20 bg-bunq-border rounded" />
        </div>
        <div className="pt-3 border-t border-bunq-border space-y-2">
          <div className="h-3 w-full bg-bunq-border/60 rounded" />
          <div className="h-3 w-4/5 bg-bunq-border/60 rounded" />
          <div className="h-3 w-3/5 bg-bunq-border/60 rounded" />
        </div>
      </div>
    </div>
  );
}
