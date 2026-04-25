"use client";

import { useCallback, useState } from "react";

interface VideoUploaderProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
}

export default function VideoUploader({ onUpload, disabled }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreview(url);
      onUpload(file);
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        htmlFor="video-input"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center w-full
          min-h-[280px] rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-300 overflow-hidden
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          ${isDragging
            ? "border-bunq-blue bg-bunq-blue/10 scale-[1.02]"
            : preview
            ? "border-bunq-green/50 bg-bunq-green/5"
            : "border-bunq-border bg-bunq-card hover:border-bunq-purple/50 hover:bg-bunq-purple/5"
          }
        `}
      >
        {preview ? (
          <>
            <video
              src={preview}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="relative z-10 flex flex-col items-center gap-3 p-6">
              <div className="w-14 h-14 rounded-full bg-bunq-green/20 border border-bunq-green/40 flex items-center justify-center">
                <svg className="w-7 h-7 text-bunq-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold text-lg">{fileName}</p>
              <p className="text-gray-400 text-sm">Click to replace</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-5 p-8">
            {/* Animated upload icon */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-bunq-gradient opacity-20 blur-xl animate-pulse-slow" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-bunq-purple/20 to-bunq-blue/20 border border-bunq-purple/30 flex items-center justify-center">
                <svg className="w-9 h-9 text-bunq-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            <div className="text-center">
              <p className="text-white font-semibold text-lg">
                {isDragging ? "Drop it here!" : "Drop your dinner video"}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                or <span className="text-bunq-blue underline underline-offset-2">browse to upload</span>
              </p>
              <p className="text-gray-600 text-xs mt-3">
                MP4, MOV, WEBM · Up to 50MB
              </p>
            </div>

            <div className="flex gap-6 mt-2">
              {["Receipt scan", "Audio detection", "Auto split"].map((feat) => (
                <div key={feat} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-bunq-green" />
                  {feat}
                </div>
              ))}
            </div>
          </div>
        )}

        <input
          id="video-input"
          type="file"
          accept="video/*"
          onChange={onInputChange}
          disabled={disabled}
          className="sr-only"
        />
      </label>
    </div>
  );
}
