import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginPage from "./page";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth/auth-provider";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  mockPush.mockReset();
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ authenticated: false }),
      });
    }

    if (url.includes("/api/auth/login")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          user: {
            id: "usr_admin",
            name: "Dr. Anjali Menon",
            email: "admin@dayahospital.com",
            role: "HOSPITAL_ADMIN",
            department: "Informatics & Medical Admin",
            canAccessRecordings: true,
            status: "ACTIVE",
          },
        }),
      });
    }

    if (url.includes("/api/auth/reset-password")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          message: "Reset link dispatched.",
        }),
      });
    }

    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
});

const renderLoginPage = () => {
  return render(
    <ToastProvider>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </ToastProvider>
  );
};

describe("LoginPage (Phase 6 - Authentication & Security)", () => {
  it("renders Daya Hospital branding, title, and credential inputs", async () => {
    renderLoginPage();

    expect(
      screen.getByText("AI Calling Operations Portal")
    ).toBeInTheDocument();
    expect(
      screen.getByText("NABH Aligned Clinical Security")
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/e\.g\. admin@dayahospital\.com/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("••••••••••••")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign In to Hospital Portal/i })
    ).toBeInTheDocument();
  });

  it("populates admin credentials via Quick Demo Fill button", async () => {
    renderLoginPage();

    const adminBtn = screen.getByRole("button", { name: /Admin/i });
    fireEvent.click(adminBtn);

    const emailInput = screen.getByPlaceholderText(
      /e\.g\. admin@dayahospital\.com/i
    ) as HTMLInputElement;
    expect(emailInput.value).toBe("admin@dayahospital.com");
  });

  it("toggles password visibility with show/hide control", async () => {
    renderLoginPage();

    const pwdInput = screen.getByPlaceholderText("••••••••••••") as HTMLInputElement;
    expect(pwdInput.type).toBe("password");

    const toggleBtn = screen.getByLabelText(/Show password/i);
    fireEvent.click(toggleBtn);
    expect(pwdInput.type).toBe("text");

    const hideBtn = screen.getByLabelText(/Hide password/i);
    fireEvent.click(hideBtn);
    expect(pwdInput.type).toBe("password");
  });

  it("submits valid login credentials and redirects to overview", async () => {
    renderLoginPage();

    // Quick fill and submit
    const adminBtn = screen.getByRole("button", { name: /Admin/i });
    fireEvent.click(adminBtn);

    const submitBtn = screen.getByRole("button", {
      name: /Sign In to Hospital Portal/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/overview");
    });
  });

  it("opens and submits the Password Reset modal", async () => {
    renderLoginPage();

    const forgotLink = screen.getByText(/Forgot password\?/i);
    fireEvent.click(forgotLink);

    expect(
      screen.getByText("Reset Hospital Portal Password")
    ).toBeInTheDocument();

    const resetInput = screen.getByPlaceholderText(/e\.g\. staff@dayahospital\.com/i);
    fireEvent.change(resetInput, { target: { value: "staff@dayahospital.com" } });

    const sendBtn = screen.getByRole("button", { name: /Send Reset Link/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText("Request Received")).toBeInTheDocument();
    });
  });
});
