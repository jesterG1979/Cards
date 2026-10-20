"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardMatch } from "@/components/card-match";
import { autoSnapReady, frameSteady, holdProgress, meanAbsDiff, snapCooldownUntil } from "@/lib/frame";
import { formatAud } from "@/lib/format";
import { guideCropRect } from "@/lib/guide-crop";
import type { PricedCard } from "@/lib/types";
import { cn } from "cn";

type Candidate = { card: PricedCard; score: number; hashDistance: number | null };
type IdentifyPayload = {
  names: string[];
  numbers: { num: string; denom: string; raw: string }[];
  candidates: Candidate[];
  error?: string;
};

type Phase =
  | { kind: "camera" }
  | { kind: "reading"; previewUrl: string }
  | { kind: "confirm"; result: IdentifyPayload }
  | { kind: "blocked"; message: string };

type TrayItem = {
  name: string;
  number: string;
  amountAud: number | null;
};

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const cooldownUntil = useRef(0);
  const holdFillRef = useRef<HTMLDivElement>(null);
  const holdMeterRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "camera" });
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (phase.kind !== "camera") return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setPhase({ kind: "blocked", message: "The camera needs a secure page. You can still choose a photo." });
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
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchOk(Boolean(caps?.torch));
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch (caught) {
        const name = caught instanceof DOMException ? caught.name : "";
        const message =
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera is blocked. Allow it in the browser settings, or choose a photo."
            : name === "NotFoundError"
              ? "No camera showed up. You can choose a photo instead."
              : "The camera didn't start. You can choose a photo instead.";
        setPhase({ kind: "blocked", message });
      }
    }

    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setReady(false);
      setTorchOn(false);
    };
  }, [phase.kind]);

  const identify = useCallback(async (file: Blob) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBanner(null);
    const previewUrl = URL.createObjectURL(file);
    setPhase({ kind: "reading", previewUrl });
    try {
      const body = new FormData();
      body.append("image", file, "card.jpg");
      const response = await fetch("/api/identify", { method: "POST", body, signal: controller.signal });
      const payload = (await response.json()) as IdentifyPayload;
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(payload.error || "Couldn't read that card.");
      setPhase({ kind: "confirm", result: payload });
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      cooldownUntil.current = snapCooldownUntil(Date.now(), "failed");
      const message = caught instanceof Error ? caught.message : "";
      setBanner(
        message === "Failed to fetch"
          ? "Couldn't reach the card list. Check your connection and try again."
          : message || "Couldn't read that card.",
      );
      setPhase({ kind: "camera" });
    }
  }, []);

  useEffect(() => {
    const url = phase.kind === "reading" ? phase.previewUrl : null;
    const previous = previewRef.current;
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    previewRef.current = url;
  }, [phase]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const frame = { left: 0, top: 0, width: video.videoWidth, height: video.videoHeight };
    const guide = guideRef.current?.getBoundingClientRect();
    const shown = video.getBoundingClientRect();
    // Send just the guide box (plus a margin), so a light table around the card isn't
    // mistaken for the card and the picture hash compares card to card.
    const crop =
      (guide &&
        guideCropRect(
          { width: video.videoWidth, height: video.videoHeight },
          { left: shown.left, top: shown.top, width: shown.width, height: shown.height },
          { left: guide.left, top: guide.top, width: guide.width, height: guide.height },
        )) ||
      frame;
    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height);
    canvas.toBlob(
      (blob) => {
        if (blob) void identify(blob);
      },
      "image/jpeg",
      0.92,
    );
  }, [identify]);

  useEffect(() => {
    if (phase.kind !== "camera" || !ready) return;
    let timer = 0;
    let stopped = false;
    let previous: Uint8ClampedArray | null = null;
    const diffs: number[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.videoWidth && context) {
        context.drawImage(video, 0, 0, 32, 32);
        const data = context.getImageData(0, 0, 32, 32).data;
        if (previous) {
          diffs.push(meanAbsDiff(previous, data));
          if (diffs.length > 8) diffs.shift();
          const progress = holdProgress(diffs);
          if (holdFillRef.current) holdFillRef.current.style.transform = `scaleY(${progress})`;
          if (holdMeterRef.current) {
            holdMeterRef.current.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
          }
          if (frameSteady(diffs) && autoSnapReady(Date.now(), cooldownUntil.current)) {
            stopped = true;
            captureFrame();
            return;
          }
        }
        previous = new Uint8ClampedArray(data);
      }
      timer = window.setTimeout(tick, 280);
    };

    timer = window.setTimeout(tick, 280);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [phase.kind, ready, captureFrame]);

  function choosePhoto(file: File | undefined) {
    if (file) void identify(file);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
    setTorchOn(next);
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    choosePhoto(file);
  }

  if (phase.kind === "reading") {
    return (
      <div className="relative min-h-dvh bg-black text-white">
        {/* Blob preview. next/image does not load object URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={phase.previewUrl} alt="The card just captured" className="h-dvh w-full object-contain opacity-40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6" aria-live="polite">
          <h2 className="text-3xl font-extrabold">Reading the card…</h2>
          <p className="text-lg">This usually takes a few seconds.</p>
          <Button
            type="button"
            size="xl"
            variant="secondary"
            data-testid="cancel-read"
            onClick={() => {
              abortRef.current?.abort();
              setPhase({ kind: "camera" });
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase.kind === "confirm") {
    return (
      <div className="flex min-h-dvh flex-col">
        <CardMatch
          candidates={phase.result.candidates}
          names={phase.result.names}
          numbers={phase.result.numbers}
          againLabel="Back to camera"
          onAgain={() => {
            const pause = phase.result.candidates.length === 0 ? "no-match" : "cancel";
            cooldownUntil.current = snapCooldownUntil(Date.now(), pause);
            setPhase({ kind: "camera" });
          }}
          onAdded={(item) => {
            setTray((current) => [
              { name: item.name, number: item.number, amountAud: item.amountAud },
              ...current,
            ]);
            setPhase({ kind: "camera" });
          }}
        />
      </div>
    );
  }

  if (phase.kind === "blocked") {
    return (
      <div className="flex min-h-dvh flex-col gap-4 px-5 py-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h2 className="text-3xl font-extrabold tracking-tight">Camera is not available</h2>
        <p className="rounded-2xl bg-card p-4 text-base font-bold" role="alert">
          {phase.message}
        </p>
        <Button type="button" size="xl" onClick={() => fileRef.current?.click()}>
          Choose a photo
        </Button>
        <Link href="/" className={cn(buttonVariants({ size: "xl", variant: "secondary" }), "w-full")}>
          Home
        </Link>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
      </div>
    );
  }

  const latest = tray[0];

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
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
        <div
          ref={guideRef}
          className="relative aspect-[63/88] h-[62%] max-h-full overflow-hidden rounded-2xl border-4 border-sun shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]"
        >
          <div
            ref={holdFillRef}
            data-testid="hold-progress"
            className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-sun/40"
            style={{ transform: "scaleY(0)" }}
          />
          <div
            ref={holdMeterRef}
            role="progressbar"
            aria-label="Hold steady"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            className="sr-only"
          />
        </div>
      </div>
      <Link
        href="/"
        className="absolute right-5 top-[max(0.75rem,env(safe-area-inset-top))] z-10 inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 font-extrabold"
        data-testid="scan-done"
      >
        Done{tray.length > 0 ? ` (${tray.length})` : ""}
      </Link>
      {banner ? (
        <p className="absolute inset-x-5 top-[max(3.25rem,calc(env(safe-area-inset-top)+2.5rem))] z-10 rounded-2xl bg-white px-4 py-3 pr-16 font-bold text-ink" role="alert">
          {banner}
        </p>
      ) : null}
      <p className="absolute inset-x-5 bottom-36 flex justify-center">
        <span className="max-w-sm rounded-full bg-black/80 px-4 py-2 text-center text-base font-extrabold text-white">
          Hold steady. The photo is taken when the card stops moving.
        </span>
      </p>
      {latest ? (
        <div
          className="absolute inset-x-5 bottom-52 flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-extrabold text-ink"
          data-testid="scan-tray"
        >
          <span>
            {latest.name} · {latest.number}
          </span>
          <span>{formatAud(latest.amountAud)}</span>
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="secondary" className="h-12 px-4 font-extrabold" onClick={() => fileRef.current?.click()}>
          Photo
        </Button>
        <button
          type="button"
          data-testid="shutter"
          aria-label="Take photo"
          disabled={!ready}
          onClick={captureFrame}
          className="h-20 w-20 rounded-full border-4 border-white bg-sun text-sm font-extrabold text-ink disabled:opacity-50"
        >
          Snap
        </button>
        {torchOk ? (
          <Button type="button" variant="secondary" className="h-12 px-4 font-extrabold" aria-pressed={torchOn} onClick={() => void toggleTorch()}>
            Torch
          </Button>
        ) : (
          <span className="h-12 w-16" aria-hidden="true" />
        )}
      </div>
      <input ref={fileRef} data-testid="photo-input" type="file" accept="image/*" className="sr-only" onChange={onFile} />
    </div>
  );
}
