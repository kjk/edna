import { expect, test } from "vitest";
import { parseCurrencyData } from "./currency";

// unexpected API responses are rejected, not cached (U21)
test("parseCurrencyData", () => {
  expect(parseCurrencyData('{"base_code":"USD","rates":{"EUR":0.9,"PLN":4,"BAD":0,"X":"1","lower":2}}')).toEqual({
    base: "USD",
    base_code: "USD",
    rates: { EUR: 0.9, PLN: 4 },
  });
  expect(parseCurrencyData("not json")).toBeUndefined();
  expect(parseCurrencyData("null")).toBeUndefined();
  expect(parseCurrencyData('{"rates":{"EUR":1}}')).toBeUndefined();
  expect(parseCurrencyData('{"base_code":"USD","rates":[]}')).toBeUndefined();
  expect(parseCurrencyData('{"base_code":"USD","rates":{"EUR":0}}')).toBeUndefined();
});
