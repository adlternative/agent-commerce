import { describe, expect, it } from "vitest";
import { lat64Fn10 } from "../src/lib/lat64_10";

describe("lat64Fn10", () => {
  it("returns 10", () => {
    expect(lat64Fn10()).toBe(10);
  });
});
