"use client";

import { useEffect, useState, useCallback } from "react";
import { BunqRequestInquiry } from "@/lib/bunq";

interface RequestsPanelProps {
  /** IDs returned from the send step — we highlight only those rows */
  sentIds: string[];
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  PENDING:  { label: "Pending",  dot: "bg-yellow-400",    text: "text-yellow-400" },
  ACCEPTED: { label: "Accepted", dot: "bg-bunq-green",    text: "text-bunq-green" },
  REJECTED: { label: "Rejected", dot: "bg-red-500",       text: "text-red-400" },
  REVOKED:  { label: "Revoked",  dot: "bg-gray-500",      text: "text-gray-400" },
  EXPIRED:  { label: "Expired",  dot: "bg-gray-500",      text: "text-gray-400" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function RequestsPanel({ sentIds }: RequestsPanelProps) {
  const [requests, setRequests] = useState<BunqRequestInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/list-requests");
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setRequests(data.requests ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + poll every 5 s to catch ACCEPTED transitions
  useEffect(() => {
    fetchRequests();
    const id = setInterval(fetchRequests, 5000);
    return () => clearInterval(id);
  }, [fetchRequests]);

  // Filter to only show the requests we just sent (most recent first)
  const sentSet = new Set(sentIds);
  const visible = requests
    .filter((r) => sentSet.size === 0 || sentSet.has(String(r.id)))
    .slice(0, 10);

  const allAccepted = visible.length > 0 && visible.every((r) => r.status === "ACCEPTED");

  return (
    <div className="mt-6 rounded-2xl bg-bunq-card border border-bunq-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-bunq-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Live bunq Request Status</span>
          {allAccepted && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-bunq-green/20 text-bunq-green border border-bunq-green/30">
              All accepted
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-600">
              Updated {fmt(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={fetchRequests}
            className="text-xs text-bunq-blue hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-bunq-border">
        {loading && (
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-4 h-4 rounded-full border-2 border-bunq-blue border-t-transparent animate-spin" />
            <span className="text-sm text-gray-500">Fetching from bunq sandbox...</span>
          </div>
        )}

        {error && (
          <div className="px-5 py-4 text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="px-5 py-4 text-sm text-gray-500">No requests found.</div>
        )}

        {visible.map((req) => {
          const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.PENDING;
          const isNew = sentSet.has(String(req.id));
          return (
            <div
              key={req.id}
              className={`flex items-center justify-between px-5 py-3.5 transition-colors ${
                isNew ? "bg-bunq-purple/5" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${req.status === "PENDING" ? "animate-pulse" : ""}`} />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {req.description || req.counterparty_alias?.display_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ID #{req.id} · {req.counterparty_alias?.value} · {fmt(req.created)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                <span className="text-sm font-semibold text-white">
                  {req.amount_inquired.currency === "EUR" ? "€" : req.amount_inquired.currency + " "}
                  {req.amount_inquired.value}
                </span>
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-2.5 bg-bunq-dark/40 border-t border-bunq-border">
        <p className="text-xs text-gray-600">
          Polling every 5 s · Requests sent to{" "}
          <code className="text-gray-500">sugardaddy@bunq.com</code> auto-accept in sandbox
        </p>
      </div>
    </div>
  );
}
