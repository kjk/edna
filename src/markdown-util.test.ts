import { expect, test } from "vitest";
import { getMarkdownHeadings } from "./markdown-util";

test("getMarkdownHeadings", () => {
  let s = ["intro", "# One", "text", "## Two ##", "```", "# not a heading", "```", "##### Five", "Setext", "---", "#### Four"].join(
    "\n",
  );
  let got = getMarkdownHeadings(s);
  expect(got.map((h) => [h.level, h.text])).toEqual([
    [1, "One"],
    [2, "Two"],
    [2, "Setext"],
    [4, "Four"],
  ]);
  for (let h of got) {
    expect(s[h.offset - 1] ?? "\n").toBe("\n");
  }
  expect(s.slice(got[0]!.offset).startsWith("# One")).toBe(true);
  expect(s.slice(got[3]!.offset).startsWith("#### Four")).toBe(true);
  expect(getMarkdownHeadings("no headings")).toEqual([]);
});
