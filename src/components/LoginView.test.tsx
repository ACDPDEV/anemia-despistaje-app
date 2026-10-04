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
        "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.",
      ),
    );
  });

  it("flags each empty field on its own before calling sign-in", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
    render(<LoginView />);

    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const email = screen.getByLabelText(/correo/i);
    const password = screen.getByLabelText(/contraseña/i);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "login-email-error");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute(
      "aria-describedby",
      "login-password-error",
    );
    expect(screen.getByText(/el correo electrónico es obligatorio/i)).toHaveAttribute(
      "id",
      "login-email-error",
    );
    expect(screen.getByText(/la contraseña es obligatoria/i)).toHaveAttribute(
      "id",
      "login-password-error",
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("flags only the empty password when the email is filled", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    expect(screen.getByLabelText(/correo/i)).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText(/contraseña/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("leaves fields valid when sign-in itself fails", async () => {
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
        "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.",
      ),
    );
    expect(screen.getByLabelText(/correo/i)).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(screen.getByLabelText(/contraseña/i)).not.toHaveAttribute(
      "aria-invalid",
    );
  });

  it("toggles between sign-in and sign-up modes with the correct labels", () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    render(<LoginView />);

    expect(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );

    expect(
      screen.getByRole("button", { name: /^crear cuenta$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /¿ya tienes cuenta\? iniciar sesión/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows the confirmation notice after sign-up needing confirmation", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    const spy = vi
      .spyOn(auth, "signUp")
      .mockResolvedValue({ ok: true, session: null, needsConfirmation: true });
    const onSignedIn = vi.fn();
    render(<LoginView onSignedIn={onSignedIn} />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "nuevo@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/revisa tu correo para confirmar/i),
      ).toBeInTheDocument(),
    );
    expect(spy).toHaveBeenCalledWith("nuevo@b.c", "secreta");
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();
  });

  it("returns to sign-in from the confirmation notice", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    vi.spyOn(auth, "signUp").mockResolvedValue({
      ok: true,
      session: null,
      needsConfirmation: true,
    });
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "nuevo@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/revisa tu correo para confirmar/i),
      ).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /volver a iniciar sesión/i }),
    );

    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    ).toBeInTheDocument();
  });

  it("calls onSignedIn after sign-up without confirmation", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    vi.spyOn(auth, "signUp").mockResolvedValue({
      ok: true,
      session: { access_token: "tok" },
      needsConfirmation: false,
    } as never);
    const onSignedIn = vi.fn();
    render(<LoginView onSignedIn={onSignedIn} />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
  });

  it("shows a role=alert error when sign-up fails", async () => {
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    vi.spyOn(auth, "signUp").mockRejectedValue(
      new Error("User already registered"),
    );
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ese correo ya está registrado. Inicia sesión o usa otro correo.",
      ),
    );
  });

  it("keeps the pending state label-only with no spinner (run-28 P3-1 documented skip)", async () => {
    // No Loader2/animate-spin precedent in the codebase; scattered motion
    // would break the quiet capture surface, so busy stays an honest
    // label + disabled grammar. Pinned here so a future spinner addition
    // is a deliberate decision, not drift.
    vi.spyOn(auth, "isAuthConfigured").mockReturnValue(true);
    let release!: () => void;
    const gate = new Promise<null>((resolve) => {
      release = () => resolve(null);
    });
    vi.spyOn(auth, "signInWithPassword").mockReturnValue(gate);
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const busy = await screen.findByRole("button", {
      name: /iniciando sesión/i,
    });
    expect(busy).toBeDisabled();
    // No spinner element, no animation class — label-only by decision.
    expect(busy.querySelector("svg")).toBeNull();
    expect(document.querySelector(".animate-spin")).toBeNull();
    release();
  });
});
