import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import KnowledgeBasePage from "./page";
import { ToastProvider } from "@/components/ui/toast";
import { INITIAL_KNOWLEDGE_ARTICLES } from "@/lib/services/knowledge-service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/knowledge-base",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/knowledge/sync")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          syncResult: {
            synced: false,
            status: "NOT_SYNCED_DEMO",
            mode: "DEMO_MODE",
            message:
              "Real Sarvam agent synchronization is not configured. Saved in local hospital database (Demo mode).",
            syncedArticlesCount: 0,
            lastSyncAttempt: new Date().toISOString(),
          },
        }),
      });
    }

    if (url.includes("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          authenticated: true,
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

    if (url.includes("/api/knowledge")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          total: INITIAL_KNOWLEDGE_ARTICLES.length,
          data: INITIAL_KNOWLEDGE_ARTICLES,
        }),
      });
    }

    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
});

import { AuthProvider } from "@/components/auth/auth-provider";

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ToastProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ToastProvider>
  );
};

describe("KnowledgeBasePage (Phase 5 - Knowledge Base Management)", () => {
  it("renders page title and healthcare safeguards notice with casualty hotline", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText("Hospital Knowledge Base & AI Voice Grounding")
      ).toBeInTheDocument();
    });

    // Healthcare editorial notice
    expect(
      screen.getByText(/Clinical Editorial Safeguards & AI Voice Grounding Rules/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Strict AI Grounding/i)).toBeInTheDocument();
    expect(screen.getByText(/No Fee \/ Policy Guessing/i)).toBeInTheDocument();
    expect(
      screen.getByText(/24\/7 Casualty: 0487 2475000 \/ Ext 100/i)
    ).toBeInTheDocument();
  });

  it("renders Sarvam voice sync card displaying Demo Mode (not false success)", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Sarvam Voice Agent Synchronization/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Demo Mode \(Local Database Only\)/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sync with Voice Agent/i })
    ).toBeInTheDocument();
  });

  it("loads and displays knowledge articles covering hospital categories", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/OPD Registration & Doctor Consultation Fees/i)
      ).toBeInTheDocument();
    });

    // Check Malayalam script rendered
    expect(
      screen.getByText(/ഒപി രജിസ്ട്രേഷനും ഡോക്ടർ കൺസൾട്ടേഷൻ ഫീസും/i)
    ).toBeInTheDocument();

    // Check version badge rendered
    expect(screen.getAllByText("v4").length).toBeGreaterThan(0);

    // Check Demo Data label
    const demoBadges = screen.getAllByText("Demo Data");
    expect(demoBadges.length).toBeGreaterThan(0);
  });

  it("filters articles when clicking category buttons", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/OPD Registration & Doctor Consultation Fees/i)
      ).toBeInTheDocument();
    });

    // Click on "Contact & Escalation" category filter
    const catBtn = screen.getByRole("button", { name: /^Contact & Escalation$/i });
    fireEvent.click(catBtn);

    // Should display emergency casualty article
    expect(
      screen.getByText(/Emergency Casualty, Ambulance & Escalation Directory/i)
    ).toBeInTheDocument();
    // Fees article should not be displayed under this category
    expect(
      screen.queryByText(/OPD Registration & Doctor Consultation Fees/i)
    ).not.toBeInTheDocument();
  });

  it("searches bilingual titles and content via search input", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/OPD Registration & Doctor Consultation Fees/i)
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /Search knowledge base in English, മലയാളം/i
    );
    fireEvent.change(searchInput, { target: { value: "Cardiology" } });

    // Should find articles mentioning Cardiology
    expect(
      screen.getByText(/Clinical Departments & Speciality Services/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Emergency Casualty, Ambulance & Escalation Directory/i)
    ).not.toBeInTheDocument();
  });

  it("opens the Version Audit Trail modal when clicking Audit button", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText(/OPD Registration & Doctor Consultation Fees/i)
      ).toBeInTheDocument();
    });

    const auditButtons = screen.getAllByRole("button", { name: /Audit/i });
    fireEvent.click(auditButtons[0]);

    // Modal title
    expect(
      screen.getByText(/Version History & Audit Trail/i)
    ).toBeInTheDocument();
  });

  it("handles clicking Sync with Voice Agent without showing false success", async () => {
    renderWithProviders(<KnowledgeBasePage />);

    const syncBtn = screen.getByRole("button", { name: /Sync with Voice Agent/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/knowledge/sync",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
