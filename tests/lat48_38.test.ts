import { describe, expect, it } from "vitest";
import { lat48Fn38 } from "../src/lib/lat48_38";

describe("lat48Fn38", () => {
  it("returns 38", () => {
    expect(lat48Fn38()).toBe(38);
  });
});
