import { describe, expect, it } from "vitest";
import { lat64Fn64 } from "../src/lib/lat64_64";

describe("lat64_64", () => {
  it("returns 64", () => {
    expect(lat64Fn64()).toBe(64);
  });
});
