"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface DashboardLayoutProps {
  children: React.ReactNode;
  selectedDateRange?: string;
  onDateRangeChange?: (range: string) => void;
  onRefresh?: () => void;
}

export function DashboardLayout({
  children,
  selectedDateRange,
  onDateRangeChange,
  onRefresh,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F8FC]">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          selectedDateRange={selectedDateRange}
          onDateRangeChange={onDateRangeChange}
          onRefresh={onRefresh}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
