"use client";

import { useState, useCallback, lazy, Suspense } from "react";
import VideoUploader from "@/components/VideoUploader";
import { SplitReviewCard, SplitCardSkeleton } from "@/components/SplitReviewCard";
import RequestsPanel from "@/components/RequestsPanel";
import PartySetup from "@/components/PartySetup";
import { AnalysisResult, Person, RequestStatus, SendRequestsResponse } from "@/types";

const ConfettiEffect = lazy(() => import("@/components/ConfettiEffect"));

type AppState = "idle" | "uploading" | "analyzing" | "review" | "sending" | "done";

function ProcessingIndicator({ stage }: { stage: AppState }) {
  const steps = [
    { key: "uploading", label: "Uploading video" },
    { key: "analyzing", label: "AI analyzing receipt & audio" },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div className="rounded-2xl bg-bunq-card border border-bunq-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full border-2 border-bunq-purple/30" />
            <div className="absolute inset-0 rounded-full border-2 border-bunq-blue border-t-transparent animate-spin" />
          </div>
          <span className="text-white font-semibold">
            {stage === "uploading" ? "Uploading your video..." : "AI is analyzing your dinner..."}
          </span>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => {
            const stageIndex = stage === "uploading" ? 0 : 1;
            const isDone = i < stageIndex;
            const isActive = i === stageIndex;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isDone
                      ? "bg-bunq-green"
                      : isActive
                      ? "border-2 border-bunq-blue animate-pulse"
                      : "border-2 border-bunq-border"
                  }`}
                >
                  {isDone && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${isDone ? "text-gray-400 line-through" : isActive ? "text-white" : "text-gray-600"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {stage === "analyzing" && (
          <div className="mt-5 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-xl bg-bunq-border/50 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TotalSummary({
  result,
  currency,
}: {
  result: AnalysisResult;
  currency: string;
}) {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  const splitTotal = result.splits.reduce((sum, s) => sum + s.amount_owed, 0);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-bunq-purple/10 to-bunq-blue/10 border border-bunq-purple/30 p-5 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">
            {result.restaurant_name || "Dinner"} · {result.splits.length} people
          </p>
          <p className="text-3xl font-bold text-white mt-1">
            {symbol}{result.total_amount.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Split: {symbol}{splitTotal.toFixed(2)} allocated
          </p>
        </div>
        <div className="text-right">
          {result.is_mock && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              Demo Data
            </span>
          )}
          <div className="mt-2 text-4xl">🧾</div>
        </div>
      </div>
    </div>
  );
}

function SuccessBanner({ response }: { response: SendRequestsResponse }) {
  return (
    <div className="rounded-2xl bg-bunq-green/10 border border-bunq-green/30 p-5 mb-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-bunq-green/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-bunq-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="text-white font-semibold">Payment requests sent!</p>
        <p className="text-gray-400 text-sm mt-1">
          {response.success_count} request{response.success_count !== 1 ? "s" : ""} sent successfully
          {response.fail_count > 0 ? `, ${response.fail_count} failed` : ""}.
          Your friends will receive a bunq payment request.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [people, setPeople] = useState<Person[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [requestStatuses, setRequestStatuses] = useState<RequestStatus[]>([]);
  const [sendResponse, setSendResponse] = useState<SendRequestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleVideoUpload = useCallback(async (file: File) => {
    setError(null);
    setAnalysisResult(null);
    setRequestStatuses([]);
    setSendResponse(null);
    setShowConfetti(false);
    setAppState("uploading");

    try {
      const formData = new FormData();
      formData.append("video", file);

      setAppState("analyzing");

      const res = await fetch("/api/analyze-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const result: AnalysisResult = await res.json();
      setAnalysisResult(result);
      setAppState("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setAppState("idle");
    }
  }, []);

  const matchPerson = (splitName: string): Person | undefined => {
    const lower = splitName.toLowerCase().trim();
    return people.find((p) => {
      const first = p.name.toLowerCase().split(/\s+/)[0];
      return first === lower || p.name.toLowerCase() === lower;
    });
  };

  const handleSendRequests = async () => {
    if (!analysisResult) return;
    setAppState("sending");
    setError(null);

    try {
      const res = await fetch("/api/send-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          splits: analysisResult.splits,
          currency: analysisResult.currency,
          restaurant_name: analysisResult.restaurant_name,
          people,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send requests");
      }

      const response: SendRequestsResponse = await res.json();
      setSendResponse(response);
      setRequestStatuses(response.results);
      setAppState("done");
      setShowConfetti(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send requests");
      setAppState("review");
    }
  };

  const handleReset = () => {
    setAppState("idle");
    setAnalysisResult(null);
    setRequestStatuses([]);
    setSendResponse(null);
    setError(null);
    setShowConfetti(false);
  };

  const isProcessing = appState === "uploading" || appState === "analyzing";
  const isSending = appState === "sending";

  return (
    <main className="relative min-h-screen bg-bunq-dark">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-bunq-purple/20 rounded-full blur-[120px]" />
        <div className="absolute -top-20 -right-40 w-80 h-80 bg-bunq-blue/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-60 bg-bunq-green/10 rounded-full blur-[80px]" />
      </div>

      {showConfetti && (
        <Suspense fallback={null}>
          <ConfettiEffect />
        </Suspense>
      )}

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bunq-purple/20 border border-bunq-purple/30 text-xs text-bunq-purple font-medium mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-bunq-purple animate-pulse" />
            bunq Hackathon 2025
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none mb-4">
            <span className="text-gradient">Context</span>
            <span className="text-white"> Split</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Upload a dinner video. AI reads your receipt and listens to who ordered what.
            bunq handles the rest.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {[
              { icon: "🎥", label: "Multimodal AI" },
              { icon: "🧾", label: "Receipt OCR" },
              { icon: "🎙️", label: "Audio detection" },
              { icon: "💸", label: "bunq payments" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bunq-card border border-bunq-border text-sm text-gray-400"
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        {(appState === "idle" || isProcessing) && (
          <>
            <PartySetup people={people} onChange={setPeople} disabled={isProcessing} />
            <VideoUploader onUpload={handleVideoUpload} disabled={isProcessing} />
            {isProcessing && <ProcessingIndicator stage={appState} />}
          </>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Results */}
        {(appState === "review" || appState === "sending" || appState === "done") && analysisResult && (
          <div className="mt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {sendResponse && <SuccessBanner response={sendResponse} />}
            <TotalSummary result={analysisResult} currency={analysisResult.currency} />

            {/* Skeleton while sending */}
            {isSending ? (
              <div className="grid gap-4">
                {analysisResult.splits.map((_, i) => (
                  <SplitCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                {analysisResult.splits.map((split, i) => (
                  <SplitReviewCard
                    key={split.name}
                    split={split}
                    index={i}
                    currency={analysisResult.currency}
                    requestStatus={requestStatuses.find((r) => r.name === split.name)}
                    matchedEmail={matchPerson(split.name)?.email}
                  />
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {appState === "review" && (
                <>
                  <button
                    onClick={handleSendRequests}
                    className="flex-1 relative group px-6 py-4 rounded-2xl font-bold text-white text-lg overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] glow-purple"
                    style={{
                      background: "linear-gradient(135deg, #7B4FFF 0%, #00AEFF 100%)",
                    }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Send bunq Requests
                    </span>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button
                    onClick={handleReset}
                    className="px-6 py-4 rounded-2xl font-semibold text-gray-400 bg-bunq-card border border-bunq-border hover:border-bunq-border/80 hover:text-white transition-all duration-200"
                  >
                    Upload New Video
                  </button>
                </>
              )}

              {appState === "done" && (
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-4 rounded-2xl font-semibold text-white bg-bunq-card border border-bunq-green/30 hover:border-bunq-green/60 transition-all duration-200"
                >
                  ✓ Split another dinner
                </button>
              )}
            </div>

            {/* Live bunq request status panel — visible once requests are sent */}
            {appState === "done" && (
              <RequestsPanel
                sentIds={requestStatuses
                  .filter((r) => r.requestId && !r.requestId.startsWith("mock_"))
                  .map((r) => r.requestId!)}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-16 text-gray-700 text-xs">
          Built with Claude claude-sonnet-4-6 · bunq Sandbox API · Next.js 16
        </div>
      </div>
    </main>
  );
}
