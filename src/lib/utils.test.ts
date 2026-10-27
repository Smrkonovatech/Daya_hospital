import { describe, it, expect } from "vitest";
import {
  maskPhoneNumber,
  formatDuration,
  formatCurrency,
  cn,
} from "./utils";

describe("Utility functions", () => {
  describe("cn", () => {
    it("merges class names properly", () => {
      expect(cn("px-2", "py-1", { "bg-blue-500": true, "bg-red-500": false })).toBe(
        "px-2 py-1 bg-blue-500"
      );
    });

    it("handles conflicting tailwind classes with twMerge", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
    });
  });

  describe("maskPhoneNumber", () => {
    it("masks Indian mobile numbers correctly for privacy", () => {
      const masked = maskPhoneNumber("+919846018392", false);
      expect(masked).toBe("+9198460 •••••");
    });

    it("reveals full number when reveal flag is true", () => {
      const full = maskPhoneNumber("+919846018392", true);
      expect(full).toBe("+919846018392");
    });

    it("handles empty or null gracefully", () => {
      expect(maskPhoneNumber("", false)).toBe("—");
    });
  });

  describe("formatDuration", () => {
    it("formats seconds under a minute", () => {
      expect(formatDuration(45)).toBe("45s");
    });

    it("formats minutes and padded seconds", () => {
      expect(formatDuration(125)).toBe("2m 05s");
      expect(formatDuration(60)).toBe("1m 00s");
    });
  });

  describe("formatCurrency", () => {
    it("formats Indian rupees without decimals", () => {
      const formatted = formatCurrency(450);
      expect(formatted).toContain("450");
      expect(formatted).toContain("₹");
    });
  });
});
