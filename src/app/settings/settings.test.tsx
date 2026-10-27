import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "./page";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth/auth-provider";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUser = {
  id: "usr_admin",
  name: "Dr. Anjali Menon",
  email: "admin@dayahospital.com",
  role: "HOSPITAL_ADMIN",
  department: "Informatics & Medical Admin",
  employeeId: "DGH-ADM-001",
  phone: "+91 94470 11001",
  canAccessRecordings: true,
  status: "ACTIVE",
};

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          authenticated: true,
          user: mockUser,
          session: {
            userId: mockUser.id,
            name: mockUser.name,
            email: mockUser.email,
            role: mockUser.role,
            canAccessRecordings: true,
          },
        }),
      });
    }

    if (url.includes("/api/settings/users")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            mockUser,
            {
              id: "usr_staff",
              name: "Sister Mary",
              email: "staff@dayahospital.com",
              role: "HOSPITAL_STAFF",
              department: "OPD Triage Lead",
              canAccessRecordings: false,
              status: "ACTIVE",
            },
          ],
        }),
      });
    }

    if (url.includes("/api/settings/status")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            integrations: [
              {
                id: "sarvam_ai",
                name: "Sarvam AI Voice Engine (Malayalam)",
                status: "Connected (Demo Mode)",
              },
            ],
            incidents: [
              {
                id: "inc_01",
                timestamp: "2026-10-26T14:20:00+05:30",
                severity: "RESOLVED",
                title: "Sarvam Voice Model Latency Normalised",
                description: "Latency returned to 240ms.",
              },
            ],
          },
        }),
      });
    }

    if (url.includes("/api/settings")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            retentionDays: "30",
            enableMalayalamConsent: true,
            strictMasking: true,
            defaultStaffRecordingAccess: false,
            missedCallThreshold: 10,
            urgentFollowUpAlerts: true,
            emergencyCasualtyAlerts: true,
            dailyDigestEmail: true,
          },
        }),
      });
    }

    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
});

const renderSettingsPage = () => {
  return render(
    <ToastProvider>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </ToastProvider>
  );
};

describe("SettingsPage (Phase 6 - Authentication, Settings & Permissions)", () => {
  it("renders page header and all 5 organized setting tabs", async () => {
    renderSettingsPage();

    expect(
      screen.getByText("Hospital Settings & Access Control")
    ).toBeInTheDocument();

    // Verify all 5 tab triggers
    expect(screen.getByRole("tab", { name: "My Profile" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Users & Roles" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Notifications & Alerts" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Call Recording & Privacy" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "System Status & Gateways" })
    ).toBeInTheDocument();
  });

  it("displays current user profile details in My Profile tab", async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText("Hospital Staff Profile")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Dr. Anjali Menon").length).toBeGreaterThan(0);
    expect(screen.getByText(/admin@dayahospital\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/DGH-ADM-001/i)).toBeInTheDocument();
  });

  it("navigates to Users & Roles tab and displays staff directory with Add User button for Admin", async () => {
    renderSettingsPage();

    const usersTab = screen.getByRole("tab", { name: "Users & Roles" });
    fireEvent.click(usersTab);

    await waitFor(() => {
      expect(
        screen.getByText("Hospital Users & Role Permissions")
      ).toBeInTheDocument();
    });

    // Check staff members rendered
    expect(screen.getByText("Sister Mary")).toBeInTheDocument();

    // Check Add Staff User button for Admin
    expect(
      screen.getByRole("button", { name: /Add Staff User/i })
    ).toBeInTheDocument();
  });

  it("navigates to Call Recording & Privacy tab and displays retention rules", async () => {
    renderSettingsPage();

    const privacyTab = screen.getByRole("tab", {
      name: "Call Recording & Privacy",
    });
    fireEvent.click(privacyTab);

    await waitFor(() => {
      expect(
        screen.getByText(/Call Audio Recording & Patient Privacy Controls/i)
      ).toBeInTheDocument();
    });

    // Check Malayalam statutory consent toggle
    expect(
      screen.getByText(/Mandatory Malayalam Call Recording Disclosure/i)
    ).toBeInTheDocument();
  });

  it("navigates to System Status tab and displays gateway health and incidents", async () => {
    renderSettingsPage();

    const statusTab = screen.getByRole("tab", {
      name: "System Status & Gateways",
    });
    fireEvent.click(statusTab);

    await waitFor(() => {
      expect(
        screen.getByText(/Integration Gateways Health & Connectivity/i)
      ).toBeInTheDocument();
    });

    // Gateway cards
    expect(
      screen.getByText(/Sarvam AI Voice Engine \(Malayalam\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Daya Hospital Management System \(HMS\)/i)
    ).toBeInTheDocument();

    // Incident log
    expect(
      screen.getByText(/Sarvam Voice Model Latency Normalised/i)
    ).toBeInTheDocument();
  });
});
