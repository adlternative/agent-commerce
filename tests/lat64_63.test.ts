import { describe, expect, it } from "vitest";
import { lat64Fn63 } from "../src/lib/lat64_63";

describe("lat64_63", () => {
  it("returns 63", () => {
    expect(lat64Fn63()).toBe(63);
  });
});
