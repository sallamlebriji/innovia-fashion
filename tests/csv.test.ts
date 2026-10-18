import { describe, it, expect } from "vitest";
import { parseCsv } from "../apps/api/src/retail-operations.js";
describe("catalog CSV parsing", () => {
  it("preserves quoted commas, line breaks and escaped quotes", () =>
    expect(
      parseCsv(
        'name,description\r\n"Shirt, linen","A ""fine"" piece\nwith care"',
      ),
    ).toEqual([
      ["name", "description"],
      ["Shirt, linen", 'A "fine" piece\nwith care'],
    ]));
  it.each(['"unclosed', '"closed"junk,next', 'bare"quote,next'])(
    "rejects malformed CSV %s",
    (csv) => expect(() => parseCsv(csv)).toThrow(),
  );
});
