import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

interface SearchFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  isFiltered?: boolean;
  onResetFilters?: () => void;
  className?: string;
}

export function SearchFilterToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search records...",
  filters,
  actions,
  isFiltered,
  onResetFilters,
  className,
}: SearchFilterToolbarProps) {
  return (
    <Card className={cn("shadow-2xs", className)}>
      <CardContent className="p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-8 text-xs h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions (e.g. Export, New) */}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>

        {/* Filter controls row */}
        {(filters || isFiltered) && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100 text-xs">
            {filters}

            {isFiltered && onResetFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="h-7 text-xs text-[#0C5DB8] hover:underline p-1 ml-auto"
              >
                Reset filters
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
