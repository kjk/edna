import { expect, test } from "bun:test";
import {
  parseBoopFunction,
  parseBuiltInFunctions,
  parseUserFunctions,
} from "./functions";
import { len } from "./util";

test("parseFunction", async () => {
  let sampleFunc = `/**
	{
		"api":1,
		"name":"Snake Case",
		"description":"converts_your_text_to_snake_case.",
		"author":"Ivan",
		"icon":"snake",
		"tags":"snake,case,function,lodash"
	}
**/

async function main(input) {
  let lodash = (await import("https://esm.sh/lodash@4.17.21")).default;
  console.log("lodash:", lodash);
  input.text = lodash.snakeCase(input.text);
}`;

  let meta = parseBoopFunction(sampleFunc);
  expect(meta.api).toBe(1);
  expect(meta.name).toBe("Snake Case");
  expect(meta.description).toBe("converts_your_text_to_snake_case.");
  expect(meta.author).toBe("Ivan");
  expect(meta.icon).toBe("snake");
});

test("parseBuiltInFunctiosn", async () => {
  let jsRaw = await Bun.file("./src/note-built-in-functions.js").text();
  let res = parseBuiltInFunctions(jsRaw);
  expect(len(res)).toBe(64);
});

test("parseCustomFunctions", async () => {
  let jsRaw = await Bun.file(
    "./src/notes/note-custom-functions.edna.txt",
  ).text();
  let res = parseUserFunctions(jsRaw);
  expect(len(res)).toBe(1);
  expect(res[0].name).toBe("My Camel Case");
});
