export const CSV_REVOKE_MS = 60_000;

export type CsvDelivery = {
  canShareFiles: (file: File) => boolean;
  shareFiles: (file: File) => Promise<void>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  download: (url: string, fileName: string) => void;
  later: (callback: () => void, delayMs: number) => void;
};

function dismissed(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function deliverCollectionCsv(
  csv: string,
  fileName: string,
  delivery: CsvDelivery,
): Promise<"shared" | "downloaded"> {
  const file = new File([csv], fileName, { type: "text/csv" });
  let shareable = false;
  try {
    shareable = delivery.canShareFiles(file);
  } catch {
    shareable = false;
  }
  if (shareable) {
    try {
      await delivery.shareFiles(file);
      return "shared";
    } catch (error) {
      if (dismissed(error)) throw error;
    }
  }
  const url = delivery.createObjectURL(file);
  delivery.download(url, fileName);
  delivery.later(() => delivery.revokeObjectURL(url), CSV_REVOKE_MS);
  return "downloaded";
}
