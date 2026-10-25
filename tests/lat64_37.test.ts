import { describe, expect, it } from "vitest";
import { lat64Fn37 } from "../src/lib/lat64_37";

describe("lat64_37", () => {
  it("returns 37", () => {
    expect(lat64Fn37()).toBe(37);
  });
});
