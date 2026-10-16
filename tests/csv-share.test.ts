import { describe, expect, it } from "vitest";
import { CSV_REVOKE_MS, deliverCollectionCsv } from "@/lib/csv-share";

describe("collection csv delivery", () => {
  it("shares a file when the phone can share files", async () => {
    const shared: File[] = [];
    const result = await deliverCollectionCsv("name,quantity\nPikachu,1\n", "my-cards.csv", {
      canShareFiles: () => true,
      shareFiles: async (file) => {
        shared.push(file);
      },
      createObjectURL: () => {
        throw new Error("blob url");
      },
      revokeObjectURL: () => {
        throw new Error("revoke");
      },
      download: () => {
        throw new Error("download");
      },
      later: () => {
        throw new Error("timer");
      },
    });
    expect(result).toBe("shared");
    expect(shared[0]?.name).toBe("my-cards.csv");
    expect(await shared[0]?.text()).toBe("name,quantity\nPikachu,1\n");
  });

  it("downloads and revokes the blob a minute later when sharing is unavailable", async () => {
    const revoked: string[] = [];
    let opened = "";
    let delay = 0;
    const result = await deliverCollectionCsv("a,b\n", "my-cards.csv", {
      canShareFiles: () => false,
      shareFiles: async () => {
        throw new Error("share");
      },
      createObjectURL: () => "blob:card",
      revokeObjectURL: (url) => {
        revoked.push(url);
      },
      download: (url, fileName) => {
        opened = `${url} ${fileName}`;
      },
      later: (callback, ms) => {
        expect(revoked).toEqual([]);
        delay = ms;
        callback();
      },
    });
    expect(result).toBe("downloaded");
    expect(opened).toBe("blob:card my-cards.csv");
    expect(delay).toBe(CSV_REVOKE_MS);
    expect(CSV_REVOKE_MS).toBe(60_000);
    expect(revoked).toEqual(["blob:card"]);
  });

  it("leaves the list on the phone when the share sheet is dismissed", async () => {
    const error = new Error("cancel");
    error.name = "AbortError";
    await expect(
      deliverCollectionCsv("a,b\n", "my-cards.csv", {
        canShareFiles: () => true,
        shareFiles: async () => {
          throw error;
        },
        createObjectURL: () => {
          throw new Error("blob url");
        },
        revokeObjectURL: () => {
          throw new Error("revoke");
        },
        download: () => {
          throw new Error("download");
        },
        later: () => {
          throw new Error("timer");
        },
      }),
    ).rejects.toThrow("cancel");
  });
});
