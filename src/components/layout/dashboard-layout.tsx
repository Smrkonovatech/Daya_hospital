"use client";

import * as React from "react";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

interface DashboardLayoutProps {
  children: React.ReactNode;
  selectedDateRange?: string;
  onDateRangeChange?: (range: string) => void;
  onRefresh?: () => void;
}

export function DashboardLayout({
  children,
  onRefresh,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F5F8FC] text-[#152238] antialiased">
      {/* Shared Header (No sidebar anywhere) */}
      <Header onRefresh={onRefresh} />

      {/* Main Content Area with bottom padding to ensure no content is obscured by bottom nav */}
      <main className="flex-1 w-full px-2 sm:px-4 lg:px-6 pt-1 pb-16 md:pb-18">
        {children}
      </main>

      {/* Persistent Bottom Navigation on every screen */}
      <BottomNav />
    </div>
  );
}
