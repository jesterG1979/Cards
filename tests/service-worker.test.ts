import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: { request: Request & { mode?: string }; respondWith: (p: Promise<Response>) => void; waitUntil: (p: Promise<unknown>) => void }) => void;

function loadWorker(fetchImpl: (request: Request) => Promise<Response>) {
  const listeners = new Map<string, Listener>();
  const cached = new Map<string, Response>();
  const cache = {
    add: vi.fn(async (path: string) => {
      if (path === "/scan") throw new Error("login redirect");
      cached.set(path, new Response(`page ${path}`));
    }),
    put: vi.fn(async (key: Request | string, response: Response) => {
      cached.set(typeof key === "string" ? key : new URL(key.url).pathname, response);
    }),
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async (key: Request | string) => cached.get(typeof key === "string" ? key : new URL(key.url).pathname),
  };
  const self = {
    location: { origin: "https://cards.test" },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: async () => {} },
  };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches, fetch: fetchImpl, URL, Response, Promise });
  return { listeners, cache, cached, self };
}

function dispatch(listeners: Map<string, Listener>, url: string, init: { mode?: string; headers?: Record<string, string> } = {}) {
  const request = Object.assign(new Request(url, { headers: init.headers }), {}) as Request & { mode?: string };
  Object.defineProperty(request, "mode", { value: init.mode ?? "cors" });
  let response: Promise<Response> | null = null;
  listeners.get("fetch")?.({ request, respondWith: (p) => (response = p), waitUntil: () => {} });
  return response as Promise<Response> | null;
}

describe("service worker (F-04)", () => {
  it("installs even when one shell page fails (expired Access session)", async () => {
    const { listeners, self } = loadWorker(async () => new Response("ok"));
    let done: Promise<unknown> = Promise.resolve();
    listeners.get("install")?.({ request: new Request("https://cards.test/"), respondWith: () => {}, waitUntil: (p) => (done = p) });
    await done;
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it("leaves Next.js router payloads alone", () => {
    const { listeners } = loadWorker(async () => new Response("ok"));
    expect(dispatch(listeners, "https://cards.test/scan?_rsc=abc")).toBeNull();
    expect(dispatch(listeners, "https://cards.test/scan", { headers: { RSC: "1" } })).toBeNull();
  });

  it("never answers a non-page request with the cached home page", async () => {
    const { listeners, cached } = loadWorker(async () => {
      throw new TypeError("offline");
    });
    cached.set("/", new Response("home html"));
    const response = await dispatch(listeners, "https://cards.test/icon-192.png");
    expect(response?.type).toBe("error");
  });

  it("falls back to the cached page for an offline navigation", async () => {
    const { listeners, cached } = loadWorker(async () => {
      throw new TypeError("offline");
    });
    cached.set("/collection", new Response("collection html"));
    const response = await dispatch(listeners, "https://cards.test/collection", { mode: "navigate" });
    expect(await response?.text()).toBe("collection html");
  });

  it("does not cache a redirected response", async () => {
    const redirected = new Response("login");
    Object.defineProperty(redirected, "redirected", { value: true });
    Object.defineProperty(redirected, "type", { value: "basic" });
    const { listeners, cache } = loadWorker(async () => redirected);
    await dispatch(listeners, "https://cards.test/collection", { mode: "navigate" });
    expect(cache.put).not.toHaveBeenCalled();
  });
});
