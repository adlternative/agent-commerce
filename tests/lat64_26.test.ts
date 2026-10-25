import { describe, expect, it } from "vitest";
import { lat64Fn26 } from "../src/lib/lat64_26";

describe("lat64_26", () => {
  it("returns 26", () => {
    expect(lat64Fn26()).toBe(26);
  });
});
