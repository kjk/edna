import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { boopFunctionResult, parseBoopFunction, parseBuiltInFunctions, parseUserFunctions } from "./functions";
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

  let meta = parseBoopFunction(sampleFunc)!;
  expect(meta.api).toBe(1);
  expect(meta.name).toBe("Snake Case");
  expect(meta.description).toBe("converts_your_text_to_snake_case.");
  expect(meta.author).toBe("Ivan");
  expect(meta.icon).toBe("snake");
});

test("parseBuiltInFunctions", async () => {
  let jsRaw = readFileSync("src/notes/note-built-in-functions.js", "utf8");
  let res = parseBuiltInFunctions(jsRaw);
  expect(len(res)).toBe(66);
});

test("parseCustomFunctions", async () => {
  let jsRaw = readFileSync("./src/notes/note-custom-functions.edna.txt", "utf8");
  let res = parseUserFunctions(jsRaw);
  expect(len(res)).toBe(1);
  expect(res[0].name).toBe("My Camel Case");
});

// functions and their metadata are user code (U17)
test("parseBoopFunction: invalid metadata", () => {
  expect(parseBoopFunction("/**null**/ x")).toBeNull();
  expect(parseBoopFunction("/**5**/ x")).toBeNull();
  expect(parseBoopFunction('**/ /**{"name":"x"}')).toBeNull();
  expect(parseBoopFunction('/**{"name":"x"} no end')).toBeNull();
  expect(parseBoopFunction('/**{"name":"x","description":{"a":1}}**/ code')!.description).toBe("[object Object]");
});

test("boopFunctionResult", () => {
  expect(boopFunctionResult({ text: "a", fullText: "a" }, "a")).toBe("a");
  expect(boopFunctionResult({ text: "b", fullText: "a" }, "a")).toBe("b");
  expect(boopFunctionResult({ text: "b", fullText: "c" }, "a")).toBe("c");
  expect(() => boopFunctionResult({ text: 42, fullText: "a" }, "a")).toThrow("input.text must be a string, is number");
  expect(() => boopFunctionResult({ text: "a", fullText: undefined }, "a")).toThrow("input.fullText");
});
