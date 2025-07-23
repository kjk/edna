package server

import (
	"bytes"
	"fmt"
	"strings"
)

func writeEscapedString(buf *bytes.Buffer, v string) {
	buf.WriteByte('"')
	for _, r := range v {
		if r == '"' || r == '\\' || r == '\n' {
			buf.WriteByte('\\')
		}
		buf.WriteRune(r)
	}
	buf.WriteByte('"')
}

func parseEscapedString(s string) string {
	var buf bytes.Buffer
	for i := 0; i < len(s); i++ {
		if s[i] == '\\' {
			i++
			if i >= len(s) {
				return ""
			}
			switch s[i] {
			case '"', '\\':
				buf.WriteByte(s[i])
			case 'n':
				buf.WriteByte('\n')
			default:
				return ""
			}
		} else {
			buf.WriteByte(s[i])
		}
	}
	return buf.String()
}

func simpleKVSerialize(keyValues ...string) (string, error) {
	if len(keyValues)%2 != 0 {
		return "", fmt.Errorf("odd number of key-value pairs")
	}
	var buf bytes.Buffer
	for i := 0; i < len(keyValues); i += 2 {
		key := keyValues[i]
		if strings.Contains(key, " ") || strings.Contains(key, "\n") {
			return "", fmt.Errorf("key '%s' contains space or newline", key)
		}
		buf.WriteString(key)
		buf.WriteByte(':')
		v := keyValues[i+1]
		if strings.Contains(v, " ") || strings.Contains(v, "\n") {
			writeEscapedString(&buf, v)
		} else {
			buf.WriteString(v)
		}
	}
	return buf.String(), nil
}

func simpleKVParse(str string) []string {
	var res []string
	s := str
	for len(s) > 0 {
		keyEnd := strings.IndexByte(s, ':')
		if keyEnd == -1 {
			return res
		}
		// key
		push(&res, s[:keyEnd])
		s = s[keyEnd+1:]
		if len(s) == 0 {
			// TODO: return error
			return res
		}
		if s[0] == '"' {
			// value is escaped
		} else {
			valEnd := strings.IndexByte(s, ' ')
			if valEnd == -1 {
				push(&res, s)
				return res
			}
			push(&res, s[:valEnd])
			s = s[valEnd+1:]
		}
	}
	return res
}
