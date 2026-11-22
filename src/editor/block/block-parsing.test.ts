import { expect, test } from "vitest";
import { parseDelimiterLine } from "../new-parser/node-types";
import { getBlocksFromString } from "./block-parsing";

test("parseDelimiterLine", () => {
  expect(parseDelimiterLine("∞∞∞text")).toEqual({ language: "text", autoDetect: false });
  expect(parseDelimiterLine("∞∞∞markdown-a")).toEqual({ language: "markdown", autoDetect: true });
  expect(parseDelimiterLine("∞∞∞")).toBeNull();
  expect(parseDelimiterLine("∞∞∞Text")).toBeNull();
  expect(parseDelimiterLine("∞∞∞foo bar")).toBeNull();
  expect(parseDelimiterLine("∞∞∞text-a ")).toBeNull();
});

test("getBlocksFromString ignores lines that are not valid delimiters", () => {
  const s = "\n∞∞∞text\nfoo\n∞∞∞not a delimiter\nbar\n∞∞∞math-a\n1+1";
  const blocks = getBlocksFromString(s);
  expect(blocks.map((b) => [b.language, b.autoDetect])).toEqual([
    ["text", false],
    ["math", true],
  ]);
  expect(s.slice(blocks[0]!.contentFrom, blocks[0]!.to)).toBe("foo\n∞∞∞not a delimiter\nbar");
  expect(s.slice(blocks[1]!.contentFrom, blocks[1]!.to)).toBe("1+1");
});
