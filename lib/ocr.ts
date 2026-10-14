import { spawn } from "node:child_process";
import { CardPriceError } from "@/lib/errors";

export const TESSERACT_TIMEOUT_MS = 20000;

export function runTesseract(image: Buffer, psm: "6" | "11", signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CardPriceError("The scan was cancelled.", 499));
      return;
    }
    const proc = spawn("tesseract", ["stdin", "stdout", "--psm", psm, "--oem", "1"], {
      stdio: ["pipe", "pipe", "pipe"],
      // One OpenMP thread per process; several threads per pass just thrash a small container.
      env: { ...process.env, OMP_THREAD_LIMIT: "1" },
    });
    const onAbort = () => {
      proc.kill("SIGKILL");
      reject(new CardPriceError("The scan was cancelled.", 499));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const out: Buffer[] = [];
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new CardPriceError("Reading the card took too long. Try a clearer photo.", 504));
    }, TESSERACT_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.stderr.on("data", () => {
      /* Drain stderr so a full pipe cannot stall Tesseract. */
    });
    proc.stdin.on("error", () => {
      /* The process can exit before stdin finishes. */
    });
    proc.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
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
      signal?.removeEventListener("abort", onAbort);
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
