import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginView } from "./LoginView";
import * as auth from "../lib/auth";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("LoginView", () => {
  it("renders the email+password form when auth is configured", () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    render(<LoginView />);
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
  });

  it("renders the offline/local-only notice when unconfigured", () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(false);
    render(<LoginView />);
    expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();
    expect(screen.getByText(/sin conexión en este equipo/i)).toBeInTheDocument();
  });

  it("shows a role=alert error when sign-in fails", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    vi.spyOn(auth, "signInWithPassword").mockRejectedValue(
      new Error("Invalid login credentials"),
    );
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Invalid login credentials",
      ),
    );
  });

  it("requires email and password before calling sign-in", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
    render(<LoginView />);

    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/obligatorios/);
    expect(spy).not.toHaveBeenCalled();
  });
});
