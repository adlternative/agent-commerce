import { describe, expect, it } from "vitest";
import { lat64Fn38 } from "../src/lib/lat64_38";

describe("lat64Fn38", () => {
  it("returns 38", () => {
    expect(lat64Fn38()).toBe(38);
  });
});
