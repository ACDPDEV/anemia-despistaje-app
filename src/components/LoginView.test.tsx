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
    expect(screen.getByLabelText(/contraseña/i, { selector: "input" })).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "clave-mala" },
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
    const password = screen.getByLabelText(/contraseña/i, { selector: "input" });
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
    expect(screen.getByLabelText(/contraseña/i, { selector: "input" })).toHaveAttribute(
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "clave-mala" },
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
    expect(screen.getByLabelText(/contraseña/i, { selector: "input" })).not.toHaveAttribute(
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    // Run-30 P2-b: the confirmation is a focused status, not plain text.
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/revisa tu correo para confirmar/i);
    // Focus lands via effect after the async sign-up resolves: poll for it.
    await waitFor(() => expect(document.activeElement).toBe(notice));
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /revisa tu correo para confirmar/i,
      ),
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ese correo ya está registrado. Inicia sesión o usa otro correo.",
      ),
    );
  });

  it("keeps the pending state label-only with no spinner (run-28 P3-1 documented skip)", async () => {    // No Loader2/animate-spin precedent in the codebase; scattered motion
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
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

  it("moves focus to the form-level alert when sign-in fails (run-30 P2-b)", async () => {
    vi.spyOn(auth, "signInWithPassword").mockRejectedValue(
      new Error("Invalid login credentials"),
    );
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "clave-mala" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.",
    );
    // Focus lands via effect after the async rejection settles: poll for it.
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it("moves focus to the email field when switching modes (run-30 P2-b)", () => {
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    expect(screen.getByLabelText(/correo/i)).toHaveFocus();

    fireEvent.click(
      screen.getByRole("button", {
        name: /¿ya tienes cuenta\? iniciar sesión/i,
      }),
    );
    expect(screen.getByLabelText(/correo/i)).toHaveFocus();
  });
});

describe("LoginView email format (run-30 P2-a)", () => {
  it("rejects a malformed email on blur and submit before any network call", () => {
    const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
    render(<LoginView />);

    const email = screen.getByLabelText(/correo/i);
    fireEvent.change(email, { target: { value: "sin-arroba" } });
    fireEvent.blur(email);

    const formatError = screen.getByText(
      /escribe un correo electrónico válido/i,
    );
    expect(formatError).toHaveAttribute("id", "login-email-error");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "login-email-error");

    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(spy).not.toHaveBeenCalled();
  });

  it("leaves empty blur alone and clears the format error once valid", () => {
    render(<LoginView />);

    const email = screen.getByLabelText(/correo/i);
    // Empty blur is not a nag: required stays a submit-time check.
    fireEvent.blur(email);
    expect(
      screen.queryByText(/escribe un correo electrónico válido/i),
    ).not.toBeInTheDocument();

    fireEvent.change(email, { target: { value: "mal@" } });
    fireEvent.blur(email);
    expect(
      screen.getByText(/escribe un correo electrónico válido/i),
    ).toBeInTheDocument();

    fireEvent.change(email, { target: { value: "bien@b.c" } });
    fireEvent.blur(email);
    expect(
      screen.queryByText(/escribe un correo electrónico válido/i),
    ).not.toBeInTheDocument();
    expect(email).not.toHaveAttribute("aria-invalid");
  });
});

describe("LoginView password visibility (run-30 P2-a)", () => {
  it("toggles visibility with a Spanish accessible label and coarse target", () => {
    render(<LoginView />);

    const password = screen.getByLabelText(/contraseña/i, { selector: "input" });
    expect(password).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", {
      name: /mostrar contraseña/i,
    });
    expect(toggle.className).toMatch(/min-h-11/);
    // Absolute over the field: showing/hiding never moves siblings.
    expect(toggle.className).toMatch(/absolute/);

    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: /ocultar contraseña/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /ocultar contraseña/i }),
    );
    expect(password).toHaveAttribute("type", "password");
  });
});

describe("LoginView password recovery (run-30 P2-a)", () => {
  it("sends a recovery mail after validating the email first", async () => {
    const spy = vi
      .spyOn(auth, "requestPasswordReset")
      .mockResolvedValue(undefined);
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿olvidaste tu contraseña\?/i }),
    );
    expect(
      screen.getByRole("button", { name: /enviar enlace de recuperación/i }),
    ).toBeInTheDocument();

    // Malformed addresses never reach the network.
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "sin-arroba" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar enlace de recuperación/i }),
    );
    expect(
      screen.getByText(/escribe un correo electrónico válido/i),
    ).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /enviar enlace de recuperación/i }),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith("a@b.c"));

    // Spanish confirmation, announced and focused like the sign-up one.
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/enlace para restablecer/i);
    await waitFor(() => expect(document.activeElement).toBe(notice));
  });

  it("returns to sign-in from the reset view", () => {
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿olvidaste tu contraseña\?/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /volver a iniciar sesión/i }),
    );

    expect(
      screen.getByRole("button", { name: /¿olvidaste tu contraseña\?/i }),
    ).toBeInTheDocument();
  });
});

describe("LoginView offline notice (run-30 P3)", () => {
  it("shows an honest offline notice with no gate bypass", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });
    try {
      const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
      render(<LoginView />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "Sin conexión. Revisa tu red e inténtalo de nuevo.",
      );
      // Notice only: no "continue without signing in" escape exists and
      // submit keeps its behavior (the gate is not disabled).
      expect(
        screen.queryByRole("button", { name: /sin iniciar sesión/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /continuar sin/i }),
      ).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/correo/i), {
        target: { value: "a@b.c" },
      });
      fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
        target: { value: "secreta" },
      });
      fireEvent.click(
        screen.getByRole("button", { name: /iniciar sesión/i }),
      );
      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith("a@b.c", "secreta"),
      );
    } finally {
      Object.defineProperty(window.navigator, "onLine", {
        value: true,
        configurable: true,
      });
    }
  });
});

describe("LoginView already-registered recovery (run-31 P2-a)", () => {
  async function failSignupAsRegistered() {
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
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await screen.findByRole("alert");
  }

  it("offers one-click recovery beside the already-registered alert", async () => {
    await failSignupAsRegistered();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ese correo ya está registrado. Inicia sesión o usa otro correo.",
    );
    expect(
      screen.getByRole("button", { name: /ir a iniciar sesión/i }),
    ).toBeInTheDocument();
  });

  it("switches to sign-in with the email preserved", async () => {
    await failSignupAsRegistered();

    fireEvent.click(
      screen.getByRole("button", { name: /ir a iniciar sesión/i }),
    );

    // Sign-in mode back, email kept for the retry, password dropped.
    expect(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toHaveValue("a@b.c");
    expect(
      screen.getByLabelText(/contraseña/i, { selector: "input" }),
    ).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no recovery action for other server failures", async () => {
    vi.spyOn(auth, "signUp").mockRejectedValue(new Error("boom"));
    render(<LoginView />);

    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );
    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^crear cuenta$/i }));

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: /ir a iniciar sesión/i }),
    ).not.toBeInTheDocument();
  });
});

describe("LoginView password length pre-check (run-31 P2-b)", () => {
  it("flags a short password on its field before any network call", () => {
    const signInSpy = vi
      .spyOn(auth, "signInWithPassword")
      .mockResolvedValue(null);
    const signUpSpy = vi
      .spyOn(auth, "signUp")
      .mockResolvedValue({ ok: true, session: null, needsConfirmation: true });
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "corta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const password = screen.getByLabelText(/contraseña/i, {
      selector: "input",
    });
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAttribute(
      "aria-describedby",
      "login-password-error",
    );
    const fieldError = screen.getByText(/mínimo 6 caracteres/i);
    expect(fieldError).toHaveAttribute("id", "login-password-error");
    expect(signInSpy).not.toHaveBeenCalled();
    expect(signUpSpy).not.toHaveBeenCalled();
  });

  it("lets a 6-character password reach the auth client", async () => {
    const spy = vi.spyOn(auth, "signInWithPassword").mockResolvedValue(null);
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "seis12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith("a@b.c", "seis12"),
    );
  });

  it("keeps server failures form-level even with a long-enough password", async () => {
    vi.spyOn(auth, "signInWithPassword").mockRejectedValue(
      new Error("Invalid login credentials"),
    );
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "clave-mala" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await screen.findByRole("alert");
    // Server outcome: no field owns it.
    expect(screen.getByLabelText(/correo/i)).not.toHaveAttribute(
      "aria-invalid",
    );
    expect(
      screen.getByLabelText(/contraseña/i, { selector: "input" }),
    ).not.toHaveAttribute("aria-invalid");
  });
});

describe("LoginView mode-switch hygiene (run-31 minor)", () => {
  it("clears the password but keeps the email when switching modes", () => {
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /¿no tienes cuenta\? crear cuenta/i }),
    );

    expect(screen.getByLabelText(/correo/i)).toHaveValue("a@b.c");
    expect(
      screen.getByLabelText(/contraseña/i, { selector: "input" }),
    ).toHaveValue("");
  });

  it("disables the show/hide toggle while the submit is pending", async () => {
    let release!: () => void;
    const gate = new Promise<null>((resolve) => {
      release = () => resolve(null);
    });
    vi.spyOn(auth, "signInWithPassword").mockReturnValue(gate);
    render(<LoginView />);

    fireEvent.change(screen.getByLabelText(/correo/i), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByLabelText(/contraseña/i, { selector: "input" }), {
      target: { value: "secreta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    const toggle = await screen.findByRole("button", {
      name: /mostrar contraseña/i,
    });
    expect(toggle).toBeDisabled();
    release();
  });
});
