import { readFileSync } from "fs";
import { decode } from "@toon-format/toon";
import { describe, expect, it } from "vitest";
import { getBlocksFromString, type NoteBlock } from "../src/block-format";

// generated with: bun run gen:golden
interface GoldenTestData {
  file: string;
  content: string;
  blocks: NoteBlock[];
}

const goldenData = decode(readFileSync("tests/parse-test-golden.toon", "utf-8")) as unknown as GoldenTestData[];

describe.each(goldenData)("Block parsing: $file", (testData) => {
  it("golden data is up to date with the note file", () => {
    expect(readFileSync(testData.file, "utf-8")).toBe(testData.content);
  });

  it("matches golden data", () => {
    const blocks = getBlocksFromString(testData.content);
    // checked separately for a clearer failure message
    expect(blocks.length).toBe(testData.blocks.length);
    expect(blocks).toEqual(testData.blocks);
  });
});

// both ways of getting blocks agree, also for malformed text (U26)
describe("getBlocksFromString matches the parser", async () => {
  const { parser } = await import("../src/editor/new-parser/parser");
  const D = "∞∞∞";
  const cases = [
    `\n${D}text\n${D}markdown\nx`,
    `${D}text\nhello\n${D}markdown\nx`,
    `junk\n${D}text\nhello`,
    "",
    `\n${D}text`,
    `\n${D}Text\nhi`,
    `\n${D}text\na\n${D}math-a\n1+1\n`,
    `\n${D}text-ro\na\n${D}math-a-ro\n1+1\n${D}text-ro-a\nb`,
  ];
  for (const s of cases) {
    it(JSON.stringify(s), () => {
      const tree: [number, number][] = [];
      parser.parse(s).iterate({
        enter: (n) => {
          if (n.name === "Note") {
            tree.push([n.from, n.to]);
            return false;
          }
        },
      });
      expect(getBlocksFromString(s).map((b) => [b.from, b.to])).toEqual(tree);
    });
  }
});
