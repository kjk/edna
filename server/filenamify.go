package server

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// those are file names that are invalid on Windows etc.
var invalidFileNameRegexp = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com\d|lpt\d|\.|\.\.|\d)$`)

func isInvalidFileName(s string) bool {
	return invalidFileNameRegexp.MatchString(s)
}

// ToValidFileName converts a UTF-8 string into a valid filename by escaping invalid runes
// or '%' as % followed by 4 hex digits of the rune code point.
func ToValidFileName(s string) string {
	var sb strings.Builder
	if isInvalidFileName(s) {
		for _, r := range s {
			sb.WriteString("%")
			fmt.Fprintf(&sb, "%04x", r)
		}
		return sb.String()
	}

	for _, r := range s {
		if unicode.IsControl(r) || r == '%' || strings.ContainsRune(`\/:*?"<>|`, r) {
			sb.WriteString("%")
			fmt.Fprintf(&sb, "%04x", r)
		} else {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// FromEncodedFileName decodes a filename back to the original string by parsing
// % followed by 4 hex digits as a rune.
func FromEncodedFileName(s string) string {
	var sb strings.Builder
	i := 0
	for i < len(s) {
		if s[i] == '%' && i+4 < len(s) {
			hexStr := s[i+1 : i+5]
			n, err := strconv.ParseUint(hexStr, 16, 32) // parse hex string to uint32
			if err == nil {
				sb.WriteRune(rune(n))
				i += 5
				continue
			}
		}
		// If not a valid escape sequence, or normal byte, write it as is
		sb.WriteByte(s[i])
		i++
	}
	return sb.String()
}
