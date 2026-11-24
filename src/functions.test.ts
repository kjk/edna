import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  boopFunctionResult,
  convertArgValues,
  isCursorFunction,
  parseArgSchema,
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
  expect(len(res)).toBe(67);
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

test("isCursorFunction (#52)", () => {
  let mk = (meta: object) => parseBoopFunction(`/**${JSON.stringify({ name: "f", ...meta })}**/ function main(input) {}`)!;
  expect(isCursorFunction(mk({ api: 2, output: "cursor" }))).toBe(true);
  expect(isCursorFunction(mk({ api: 1, output: "cursor" }))).toBe(false);
  expect(isCursorFunction(mk({ api: 2 }))).toBe(false);
  // user-editable: a non-string value doesn't crash
  expect(isCursorFunction(mk({ api: 2, output: 5 }))).toBe(false);
});

test("parseArgSchema (#60)", () => {
  expect(parseArgSchema([["url", "string", "page url"], ["n", "number"], ["dry"]])).toEqual([
    { name: "url", type: "string", description: "page url" },
    { name: "n", type: "number", description: "" },
    { name: "dry", type: "string", description: "" },
  ]);
  expect(parseArgSchema(["a", "b"]).map((s) => s.name)).toEqual(["a", "b"]);
  // user code: invalid schemas give a descriptive error
  expect(() => parseArgSchema(null)).toThrow("non-empty array");
  expect(() => parseArgSchema([])).toThrow("non-empty array");
  expect(() => parseArgSchema([[5]])).toThrow("invalid argument name");
  expect(() => parseArgSchema([["a", "date"]])).toThrow("invalid type");
  expect(() => parseArgSchema([["a"], ["a"]])).toThrow("duplicate");
});

test("convertArgValues (#60)", () => {
  let specs = parseArgSchema([["s"], ["n", "number"], ["b", "boolean"], ["t", "text"]]);
  expect(convertArgValues(specs, { s: "x", n: " 2.5 ", b: true, t: "a\nb" })).toEqual({
    values: { s: "x", n: 2.5, b: true, t: "a\nb" },
  });
  expect(convertArgValues(specs, { s: "", n: "0" })).toEqual({ values: { s: "", n: 0, b: false, t: "" } });
  expect(convertArgValues(specs, { n: "abc" })).toEqual({ error: "'n' must be a number" });
  expect(convertArgValues(specs, { n: "" })).toEqual({ error: "'n' must be a number" });
});
