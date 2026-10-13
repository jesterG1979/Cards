"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardMatch } from "@/components/card-match";
import { TopBar } from "@/components/top-bar";
import type { PricedCard } from "@/lib/types";

type Candidate = { card: PricedCard; score: number; hashDistance: number | null };
type IdentifyPayload = {
  names: string[];
  numbers: { num: string; denom: string; raw: string }[];
  candidates: Candidate[];
  error?: string;
};

type Mode = "start" | "camera" | "reading" | "result";

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("start");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyPayload | null>(null);

  useEffect(() => {
    if (mode !== "camera") return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs a secure page. You can still choose a photo.");
        setMode("start");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch (caught) {
        const name = caught instanceof DOMException ? caught.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("Camera is blocked. Allow it in Safari settings, or choose a photo.");
        } else if (name === "NotFoundError") {
          setError("No camera showed up. You can choose a photo instead.");
        } else {
          setError("The camera didn't start. You can choose a photo instead.");
        }
        setMode("start");
      }
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode]);

  async function identify(file: Blob) {
    setMode("reading");
    setError(null);
    try {
      const body = new FormData();
      body.append("image", file, "card.jpg");
      const response = await fetch("/api/identify", { method: "POST", body });
      const payload = (await response.json()) as IdentifyPayload;
      if (!response.ok) throw new Error(payload.error || "Couldn't read that card.");
      setResult(payload);
      setMode("result");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setError(
        message === "Failed to fetch"
          ? "Couldn't reach the card list. Check your connection and try again."
          : message || "Couldn't read that card.",
      );
      setMode("start");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) void identify(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  if (mode === "camera") {
    return (
      <div className="relative min-h-dvh bg-black text-white">
        <video
          ref={videoRef}
          className="h-dvh w-full object-contain"
          autoPlay
          muted
          playsInline
          onLoadedMetadata={() => setReady(true)}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 pt-[max(4.5rem,env(safe-area-inset-top))]">
          <div className="aspect-[63/88] h-[68%] max-h-full rounded-2xl border-4 border-sun shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]" />
        </div>
        <p className="absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] px-6 text-center text-base font-extrabold">
          Fit the whole card in the box, including the number at the bottom.
        </p>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="secondary" className="h-12 px-4 font-extrabold" onClick={() => setMode("start")}>
            Back
          </Button>
          <button
            type="button"
            data-testid="shutter"
            disabled={!ready}
            onClick={takePhoto}
            className="h-20 w-20 rounded-full border-4 border-white bg-sun text-sm font-extrabold text-ink disabled:opacity-50"
          >
            Snap
          </button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 px-4 font-extrabold"
            onClick={() => fileRef.current?.click()}
          >
            Photo
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void identify(file);
          }}
        />
      </div>
    );
  }

  if (mode === "reading") {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Scan" />
        <div className="flex flex-1 flex-col justify-center gap-3 px-6" aria-live="polite">
          <h2 className="text-3xl font-extrabold">Reading the card…</h2>
          <p className="text-lg text-muted-foreground">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (mode === "result" && result) {
    return (
      <div className="flex min-h-dvh flex-col">
        <TopBar title="Scan" />
        <CardMatch
          candidates={result.candidates}
          names={result.names}
          numbers={result.numbers}
          againLabel="Scan again"
          onAgain={() => {
            setResult(null);
            setMode("start");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Scan" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <h2 className="text-3xl font-extrabold tracking-tight">Point it at one card</h2>
        <p className="text-lg leading-snug">
          Fit the whole card in the picture, including the little number at the bottom.
        </p>
        {error ? (
          <p className="rounded-2xl bg-card p-4 text-base font-bold" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          size="xl"
          data-testid="open-camera"
          onClick={() => {
            setReady(false);
            setError(null);
            setMode("camera");
          }}
        >
          Use the camera
        </Button>
        <Button type="button" size="xl" variant="secondary" onClick={() => fileRef.current?.click()}>
          Choose a photo
        </Button>
        <input
          ref={fileRef}
          data-testid="photo-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void identify(file);
          }}
        />
        <p className="text-sm leading-relaxed text-muted-foreground">
          The photo is sent to this app so it can read the card. It isn&apos;t saved.
        </p>
      </div>
    </div>
  );
}
