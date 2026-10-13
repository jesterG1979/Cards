import Image from "next/image";
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
  if (!src) return <div className={cn("bg-muted", className)} />;
  return (
    <Image
      src={src}
      alt={alt}
      width={245}
      height={342}
      className={className}
    />
  );
}
