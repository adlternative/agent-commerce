import { describe, expect, it } from "vitest";
import { lat64Fn32 } from "../src/lib/lat64_32";

describe("lat64_32", () => {
  it("returns 32", () => {
    expect(lat64Fn32()).toBe(32);
  });
});
