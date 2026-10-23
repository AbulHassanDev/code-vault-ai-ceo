import { describe, it, expect } from "vitest";
import { applyDiscount } from "./discount";

describe("applyDiscount", () => {
  it("takes 10% off 49 USDT", () => expect(applyDiscount(4900, 10).totalCents).toBe(4410));
  it("no code means full price", () => expect(applyDiscount(4900, null).totalCents).toBe(4900));
  it("never goes below zero", () => expect(applyDiscount(4900, 150).totalCents).toBe(0));
});
