package server

import (
	"strings"
	"testing"
)

func TestToValidFileName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"document.txt", "document.txt"},
		{"my document.txt", "my document.txt"},
		{"файл.txt", "файл.txt"},
		{"", ""},

		// Invalid Windows names
		{"CON", "%0043%004f%004e"},
		{"con", "%0063%006f%006e"},
		{"PRN", "%0050%0052%004e"},
		{"AUX", "%0041%0055%0058"},
		{"NUL", "%004e%0055%004c"},
		{"COM1", "%0043%004f%004d%0031"},
		{"LPT1", "%004c%0050%0054%0031"},
		{".", "%002e"},
		{"..", "%002e%002e"},

		// Invalid characters
		{"file\\name", "file%005cname"},
		{"file/name", "file%002fname"},
		{"file:name", "file%003aname"},
		{"file*name", "file%002aname"},
		{"file?name", "file%003fname"},
		{"file\"name", "file%0022name"},
		{"file<name", "file%003cname"},
		{"file>name", "file%003ename"},
		{"file|name", "file%007cname"},
		{"file%name", "file%0025name"},

		// Control characters
		{"file\tname", "file%0009name"},
		{"file\nname", "file%000aname"},
		{"file\rname", "file%000dname"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := ToValidFileName(tt.input)
			if result != tt.expected {
				t.Errorf("ToValidFileName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFromEncodedFileName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"document.txt", "document.txt"},
		{"", ""},
		{"%0041", "A"},
		{"%0041%0042%0043", "ABC"},
		{"file%0041name", "fileAname"},
		{"%0444%0430%0439%043b", "файл"},

		// Invalid encoding (should be preserved as-is)
		{"%ZZZZ", "%ZZZZ"},
		{"%004", "%004"},
		{"file%", "file%"},
		{"%04", "%04"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := FromEncodedFileName(tt.input)
			if result != tt.expected {
				t.Errorf("FromEncodedFileName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestRoundTrip(t *testing.T) {
	testStrings := []string{
		"",
		"simple.txt",
		"file with spaces.doc",
		"CON",
		"PRN.txt",
		"file/with\\invalid:chars*?\"<>|",
		"file%with%percent",
		"unicode_файл_文件.txt",
		"file\twith\ncontrol\rchars",
		"a",
		".",
		"..",
		"COM1",
		"LPT9",
		"file\x00with\x1fnull",
		"mixed%0041test",
		strings.Repeat("a", 255), // long filename
	}

	for _, original := range testStrings {
		t.Run("roundtrip_"+original, func(t *testing.T) {
			encoded := ToValidFileName(original)
			decoded := FromEncodedFileName(encoded)
			if decoded != original {
				t.Errorf("Round trip failed for %q: encoded=%q, decoded=%q", original, encoded, decoded)
			}
		})
	}
}

func TestRoundTripProperty(t *testing.T) {
	// Test the mathematical property: FromEncodedFileName(ToValidFileName(s)) == s
	// for a wide range of inputs including edge cases

	// Generate test strings with various Unicode ranges
	var testInputs []string

	// ASCII printable characters
	for r := rune(32); r <= 126; r++ {
		testInputs = append(testInputs, string(r))
	}

	// Control characters
	for r := rune(0); r <= 31; r++ {
		testInputs = append(testInputs, string(r))
	}

	// Extended ASCII
	for r := rune(127); r <= 255; r++ {
		testInputs = append(testInputs, string(r))
	}

	// Some Unicode characters
	unicodeTests := []string{
		"файл", "文件", "ファイル", "🚀", "café", "naïve",
	}
	testInputs = append(testInputs, unicodeTests...)

	// Reserved Windows filenames
	windowsReserved := []string{
		"CON", "PRN", "AUX", "NUL", "COM1", "COM9", "LPT1", "LPT9", ".", "..",
	}
	testInputs = append(testInputs, windowsReserved...)

	for _, input := range testInputs {
		t.Run("property_test", func(t *testing.T) {
			encoded := ToValidFileName(input)
			decoded := FromEncodedFileName(encoded)
			if decoded != input {
				t.Errorf("Property violation: FromEncodedFileName(ToValidFileName(%q)) = %q, want %q",
					input, decoded, input)
			}
		})
	}
}

func TestIsInvalidFileName(t *testing.T) {
	tests := []struct {
		filename string
		invalid  bool
	}{
		{"document.txt", false},
		{"CON", true},
		{"con", true},
		{"PRN", true},
		{"AUX", true},
		{"NUL", true},
		{"COM1", true},
		{"LPT1", true},
		{".", true},
		{"..", true},
		{"1", true},
		{"CONFIG", false},
		{"FALCON", false},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := isInvalidFileName(tt.filename)
			if result != tt.invalid {
				t.Errorf("isInvalidFileName(%q) = %v, want %v", tt.filename, result, tt.invalid)
			}
		})
	}
}

func BenchmarkToValidFileName(b *testing.B) {
	testString := "file/with\\many:invalid*chars?\"<>|and%unicode文件"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ToValidFileName(testString)
	}
}

func BenchmarkFromEncodedFileName(b *testing.B) {
	encoded := ToValidFileName("file/with\\many:invalid*chars?\"<>|and%unicode文件")
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		FromEncodedFileName(encoded)
	}
}
