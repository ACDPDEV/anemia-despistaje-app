import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePadronStore } from "./stores/padronStore";
import App from "./App";
import * as auth from "./lib/auth";

vi.mock("./lib/auth", () => ({
  isAuthConfigured: vi.fn(() => false),
  getSession: vi.fn(async () => null),
  onAuthStateChange: vi.fn(() => () => {}),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

const mockedAuth = vi.mocked(auth);

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    value: 1280,
    configurable: true,
    writable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  usePadronStore.getState().reset();
  setDesktopViewport();
  vi.clearAllMocks();
});

describe("App auth gating", () => {
  it("renders the shell directly when auth is not configured", () => {
    mockedAuth.isAuthConfigured.mockReturnValue(false);
    render(<App />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("shows LoginView when configured and unauthenticated", async () => {
    mockedAuth.isAuthConfigured.mockReturnValue(true);
    mockedAuth.getSession.mockResolvedValue(null);
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /iniciar sesión/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("shows the shell when configured and authenticated", async () => {
    mockedAuth.isAuthConfigured.mockReturnValue(true);
    mockedAuth.getSession.mockResolvedValue({
      access_token: "tok",
    } as never);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("navigation")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it("signs out from the sidebar Cerrar sesión button", async () => {
    mockedAuth.isAuthConfigured.mockReturnValue(true);
    mockedAuth.getSession.mockResolvedValue({
      access_token: "tok",
    } as never);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("navigation")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(mockedAuth.signOut).toHaveBeenCalledTimes(1);
  });

  it("hides Cerrar sesión when auth is not configured", () => {
    mockedAuth.isAuthConfigured.mockReturnValue(false);
    render(<App />);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cerrar sesión/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the brand lockup on the login card", async () => {
    mockedAuth.isAuthConfigured.mockReturnValue(true);
    mockedAuth.getSession.mockResolvedValue(null);
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /iniciar sesión/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByTestId("brand-lockup")).toBeInTheDocument();
  });
});
