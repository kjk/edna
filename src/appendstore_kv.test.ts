import { keyValueMarshal, keyValueUnmarshal } from "./appendstore_kv";

// Helper function to format strings like Go's fmt.Sprintf
function f(format: string, ...args: any[]) {
  let result = format;
  args.forEach((arg, index) => {
    result = result.replace(/%[vqd]/, arg);
  });
  return result;
}

// Helper function for assertions
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testRoundtrip() {
  const tests = [
    ["k1", "v1", "k2", "v2", "k1:v1 k2:v2"],
    ["k1", "", "k2", "v2", "k1: k2:v2"],
    ["k1", "v1", "k2", "", "k1:v1 k2:"],
    ["k1", "v1", "k2", "\n", 'k1:v1 k2:"\\n"'],
    ["k", "v l", `k:"v l"`],
    ["k1", "v1", "k2", "v2", "k3", "val3", "k1:v1 k2:v2 k3:val3"],
    ["key1", "value1", "key1:value1"],
    ["k", "", "k:"],
    ["k", 'la"ba\n', 'k:"la\\"ba\\n"'],
    ["k", "f\n", 'k:"f\\n"'],
    ["k", "lo\\la", "k:lo\\la"],
  ];

  for (const test of tests) {
    const n = test.length;
    const kv = test.slice(0, n - 1);
    const exp = test[n - 1];

    let got;
    try {
      got = keyValueMarshal(...kv);
    } catch (err) {
      throw new Error(
        f("keyValueMarshal(%v) returned error: %v", kv, err.message),
      );
    }

    assert(got === exp, f("keyValueMarshal(%v) = %q, want %q", kv, got, exp));

    let got2;
    try {
      got2 = keyValueUnmarshal(got);
    } catch (err) {
      throw new Error(
        f("keyValueUnmarshal(%q) returned error: %v", got, err.message),
      );
    }

    assert(
      got2.length === kv.length,
      f("keyValueUnmarshal(%q) returned %v, want %v", got, got2, kv),
    );

    for (let i = 0; i < kv.length; i += 2) {
      assert(
        got2[i] === kv[i],
        f("keyValueUnmarshal(%q) returned %v, want %v", got, got2, kv),
      );
      assert(
        got2[i + 1] === kv[i + 1],
        f("keyValueUnmarshal(%q) returned %v, want %v", got, got2, kv),
      );
    }
  }
}

function testInvalidMarshal() {
  const tests = [
    ["k1", "v1", "k2"], // odd number of key-value pairs
    ["k ", "v"], // key with space
    ["k\n", "v"], // key with newline
  ];

  for (const test of tests) {
    let got;
    let err = null;
    try {
      got = keyValueMarshal(...test);
    } catch (e) {
      err = e;
    }

    assert(
      err !== null,
      f("keyValueMarshal(%v) should have returned error but got %v", test, got),
    );
  }
}

function testInvalidUnmarshal() {
  const tests = [
    "k1:v1 k2", // missing value for k2
    "k1:v1 k2:v2 k3", // missing value for k3
    "k1:v1 k2:v2 k3: v4", // space before value is not ok
    "k1:v1 k2:v2 k3: v4 ", // space after value is not ok
    "k1: v1", // space in key is not ok
    "k1:v1 k2: v2", // space in value is not ok
  ];

  for (const test of tests) {
    let got;
    let err = null;
    try {
      got = keyValueUnmarshal(test);
    } catch (e) {
      err = e;
    }

    assert(
      err !== null,
      f(
        "keyValueUnmarshal(%q) should have returned error but got %v",
        test,
        got,
      ),
    );
  }
}

// Run all tests
function runTests() {
  const tests = [
    { name: "testRoundtrip", fn: testRoundtrip },
    { name: "testInvalidMarshal", fn: testInvalidMarshal },
    { name: "testInvalidUnmarshal", fn: testInvalidUnmarshal },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.fn();
      console.log(`✓ ${test.name} passed`);
      passed++;
    } catch (error) {
      console.error(`✗ ${test.name} failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

// Export test functions for external test runners
export { testRoundtrip, testInvalidMarshal, testInvalidUnmarshal, runTests };
