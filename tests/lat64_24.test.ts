import { describe, expect, it } from "vitest";
import { lat64Fn24 } from "../src/lib/lat64_24";

describe("lat64_24", () => {
  it("returns 24", () => {
    expect(lat64Fn24()).toBe(24);
  });
});
