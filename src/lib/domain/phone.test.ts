import { describe, expect, it } from "vitest";
import { formatDrcPhone, isValidDrcPhone, normalizeDrcPhone } from "./phone";

describe("normalizeDrcPhone", () => {
  it.each([
    ["0812345678", "+243812345678"],
    ["812345678", "+243812345678"],
    ["243812345678", "+243812345678"],
    ["+243 81 234 5678", "+243812345678"],
    ["00243 99 123-4567", "+243991234567"],
    ["097.123.45.67", "+243971234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDrcPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+33612345678", "0712345678", "+2438123456789", "08123abc78"])(
    "refuse %s",
    (input) => {
      expect(normalizeDrcPhone(input)).toBeNull();
      expect(isValidDrcPhone(input)).toBe(false);
    },
  );
});

describe("formatDrcPhone", () => {
  it("affiche le numéro de façon lisible", () => {
    expect(formatDrcPhone("+243812345678")).toBe("+243 81 234 5678");
  });
});
