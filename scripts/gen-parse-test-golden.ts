import { readFileSync, writeFileSync } from "fs";
import { encode } from "@toon-format/toon";
import { getBlocksFromString } from "../src/editor/block/block-parsing";

interface GoldenTestData {
  file: string;
  content: string;
  blocks: ReturnType<typeof getBlocksFromString>;
}

function generateGoldenData() {
  const files = [
    "src/notes/note-scratch-dev.edna.txt",
    "src/notes/note-scratch.edna.txt",
  ];

  const golden: GoldenTestData[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const blocks = getBlocksFromString(content);
    golden.push({
      file,
      content,
      blocks,
    });
  }

  const toonData = encode(golden);
  writeFileSync("tests/parse-test-golden.toon", toonData, "utf-8");
  console.log("Golden test data generated at tests/parse-test-golden.toon");
  console.log(`Generated data for ${golden.length} files`);
  for (const data of golden) {
    console.log(`  ${data.file}: ${data.blocks.length} blocks`);
  }
}

generateGoldenData();
