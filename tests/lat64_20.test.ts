import { describe, expect, it } from "vitest";
import { lat64Fn20 } from "../src/lib/lat64_20";

describe("lat64_20", () => {
  it("returns 20", () => {
    expect(lat64Fn20()).toBe(20);
  });
});
