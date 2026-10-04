import "@testing-library/jest-dom/vitest";
// Node >= 22 ships a global `localStorage` stub that is unavailable unless
// Node runs with `--localstorage-file`. Vitest keeps pre-existing Node
// globals instead of jsdom's working implementation, so bridge jsdom's
// Storage (or a minimal in-memory fallback) onto the test global. Without
// this, zustand/persist and any direct `localStorage` access stay undefined.
function storageWorks(value: unknown): value is Storage {
  try {
    if (!value || typeof (value as Storage).setItem !== "function") return false;
    const storage = value as Storage;
    storage.setItem("__vitest_probe__", "1");
    storage.removeItem("__vitest_probe__");
    return true;
  } catch {
    return false;
  }
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

const testGlobal = globalThis as unknown as Record<string, unknown>;
const jsdomWindow = (testGlobal.jsdom as { window?: Window } | undefined)?.window;

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (storageWorks(testGlobal[name])) continue;
  const domStorage = jsdomWindow?.[name];
  const replacement = storageWorks(domStorage) ? domStorage : createMemoryStorage();
  try {
    Object.defineProperty(testGlobal, name, {
      value: replacement,
      configurable: true,
      writable: true,
    });
  } catch {
    testGlobal[name] = replacement;
  }
}

// jsdom has no ResizeObserver, and recharts ResponsiveContainer depends on
// it. Report a fixed desktop-ish content box so responsive charts render
// deterministically in tests; real browsers observe the real box.
if (typeof globalThis.ResizeObserver === "undefined") {
  class MockResizeObserver implements ResizeObserver {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      const rect = {
        x: 0,
        y: 0,
        width: 480,
        height: 220,
        top: 0,
        left: 0,
        bottom: 220,
        right: 480,
        toJSON: () => ({}),
      };
      this.callback(
        [
          {
            target,
            contentRect: rect,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          } as unknown as ResizeObserverEntry,
        ],
        this,
      );
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = MockResizeObserver;
}
