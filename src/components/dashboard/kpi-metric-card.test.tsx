import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
import { PhoneCall } from "lucide-react";
import { KpiMetricCard } from "./kpi-metric-card";

describe("KpiMetricCard", () => {
  it("renders metric title, value, and subtitle accurately", () => {
    render(
      <KpiMetricCard
        title="Calls Offered to AI"
        value={1248}
        subtitle="from IVR rollover lines"
        icon={PhoneCall}
        change="+14.2%"
        trend="up"
        variant="blue"
      />
    );

    expect(screen.getByText("Calls Offered to AI")).toBeInTheDocument();
    expect(screen.getByText("1248")).toBeInTheDocument();
    expect(screen.getByText("from IVR rollover lines")).toBeInTheDocument();
    expect(screen.getByText("+14.2%")).toBeInTheDocument();
  });

  it("renders badge when provided", () => {
    render(
      <KpiMetricCard
        title="Answered by AI"
        value={1184}
        icon={PhoneCall}
        badge="Malayalam"
      />
    );

    expect(screen.getByText("Malayalam")).toBeInTheDocument();
  });
});
