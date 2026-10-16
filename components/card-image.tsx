"use client";

import { useState } from "react";
import { cn } from "cn";

export function CardImage({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showBack = !src || failed;
  return (
    // Plain img so a failed optimizer response cannot be shown as the picture.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={showBack ? "/card-back.svg" : src}
      alt={alt || "Card back"}
      className={cn("bg-muted object-cover", className)}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
