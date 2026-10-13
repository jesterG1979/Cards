import { spawn } from "node:child_process";
import { CardPriceError } from "@/lib/errors";

export function runTesseract(image: Buffer, psm: "6" | "11"): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("tesseract", ["stdin", "stdout", "--psm", psm, "--oem", "1"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const out: Buffer[] = [];
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new CardPriceError("Reading the card took too long. Try a clearer photo.", 504));
    }, 40000);

    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", () => {
      /* Drain stderr so a full pipe cannot stall Tesseract. */
    });
    proc.stdin.on("error", () => {
      /* The process can exit before stdin finishes. */
    });
    proc.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(
          new CardPriceError(
            "The card reader isn't set up on this computer, so scanning won't work yet.",
            500,
          ),
        );
        return;
      }
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new CardPriceError("Couldn't read the writing on that card.", 500));
        return;
      }
      resolve(Buffer.concat(out).toString("utf8"));
    });

    proc.stdin.write(image);
    proc.stdin.end();
  });
}
