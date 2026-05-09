import { formatSol, formatUsd } from "../utils/formatters";

describe("formatters", () => {
  it("formats SOL", () => {
    expect(formatSol(1.23456)).toContain("SOL");
  });

  it("formats USD", () => {
    expect(formatUsd(1000)).toBe("$1,000");
  });
});
