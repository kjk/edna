package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/kjk/common/siser"
	"github.com/toon-format/toon-go"
)

var (
	log       *WriteDaily
	httpLog   *WriteDaily
	errorsLog *WriteDaily
	eventsLog *WriteDaily

	zeroTime = time.Time{}
)

func setupLogging() {
	dir := filepath.Join(getDataDirMust(), "logs")

	log = NewWriteDaily(filepath.Join(dir, "log"))
	httpLog = NewWriteDaily(filepath.Join(dir, "http"))
	errorsLog = NewWriteDaily(filepath.Join(dir, "errors"))
	eventsLog = NewWriteDaily(filepath.Join(dir, "events"))
}

func closeWriteLog(wd **WriteDaily) {
	(*wd).Sync()
	(*wd).Close()
	*wd = nil
}

func closeLogging() {
	fmt.Printf("closeLogging()\n")
	closeWriteLog(&log)
	closeWriteLog(&httpLog)
	closeWriteLog(&errorsLog)
	closeWriteLog(&eventsLog)
}

var (
	verbose bool
)

func logf(s string, args ...any) {
	if len(args) > 0 {
		s = fmt.Sprintf(s, args...)
	}
	fmt.Print(s)
	log.WriteString(s)
	// logToChannels(s)
}

func getCallstackFrames(skip int) []string {
	var callers [32]uintptr
	n := runtime.Callers(skip+1, callers[:])
	frames := runtime.CallersFrames(callers[:n])
	var cs []string
	for {
		frame, more := frames.Next()
		if !more {
			break
		}
		s := frame.File + ":" + strconv.Itoa(frame.Line)
		cs = append(cs, s)
	}
	return cs
}

func getCallstack(skip int) string {
	frames := getCallstackFrames(skip + 1)
	return strings.Join(frames, "\n")
}

func verbosef(format string, args ...any) {
	if !verbose {
		return
	}
	logf(format, args...)
}

func logErrorf(s string, args ...any) {
	if len(args) > 0 {
		s = fmt.Sprintf(s, args...)
	}
	cs := getCallstack(1)
	fmt.Printf("%s\n%s\n", s, cs)
}

// if err != nil, log and return true
// logIfErrf(err) => logs err.Error()
// logIfErrf(err, "error is: %v", err) => logs message formatted
func logIfErrf(err error, a ...any) bool {
	if err == nil {
		return false
	}
	if len(a) == 0 {
		logErrorf(err.Error())
		return true
	}
	s, ok := a[0].(string)
	if !ok {
		// shouldn't happen but just in case
		s = fmt.Sprintf("%s", a[0])
	}
	if len(a) > 1 {
		s = fmt.Sprintf(s, a[1:]...)
	}
	logErrorf(s)
	return true
}

func logEvent(name string, vals []any) {
	n := len(vals)
	panicIf(n%2 != 0)
	var d []byte
	if n > 0 {
		m := map[string]any{}
		for i := 0; i < n; i += 2 {
			k := toStr(vals[i])
			m[k] = vals[i+1]
		}
		d, _ = toon.Marshal(m)
	}
	t := time.Now().UTC()
	d2 := siser.MarshalLine(name, t, d, nil)
	eventsLog.Write(d2)
}

func toMicroseconds(dur time.Duration) int64 {
	return int64(dur / time.Microsecond)
}

func getBestIPAddress(r *http.Request) string {
	h := r.Header
	pickFirst := func(s string) string {
		// sometimes they are stored as "ip1, ip2, ip3" with ip1 being the best
		parts := strings.Split(s, ",")
		return strings.TrimSpace(parts[0])
	}
	val := h.Get("CF-Connecting-IP")
	if len(val) > 0 {
		return pickFirst(val)
	}
	val = h.Get("X-Real-Ip")
	if len(val) > 0 {
		return pickFirst(val)
	}
	val = h.Get("X-Forwarded-For")
	if len(val) > 0 {
		return pickFirst(val)
	}
	val = r.RemoteAddr
	if len(val) > 0 {
		return pickFirst(val)
	}
	return ""
}

func appendRequestValues(vals []any, r *http.Request) []any {
	if r == nil {
		return vals
	}
	ip := getBestIPAddress(r)
	vals = append(vals, "ip", ip)
	userID := r.Header.Get("X-User")
	if userID != "" {
		vals = append(vals, "user", userID)
	}
	return vals
}

func logEventFromRequest(r *http.Request, name string, vals []any, timeStart time.Time) {
	vals = appendRequestValues(vals, r)
	if !timeStart.IsZero() {
		dur := time.Since(timeStart)
		vals = append(vals, "durmicro", toMicroseconds(dur))
	}

	logEvent(name, vals)
}

func logErrorEventFromRequest(r *http.Request, name string, vals []any, err error, timeStart time.Time) {
	vals = appendRequestValues(vals, r)
	vals = append(vals, "error", err.Error())
	if !timeStart.IsZero() {
		dur := time.Since(timeStart)
		vals = append(vals, "durmicro", toMicroseconds(dur))
	}
	logEvent(name, vals)
}

func apiLogEvent(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	var vals []any
	name := ""
	for k, va := range r.Form {
		if len(va) == 0 {
			continue
		}
		if k == "name" {
			name = va[0]
			continue
		}
		vals = append(vals, k, va[0])
	}
	v := map[string]any{
		"Message": "ok",
	}
	if name == "" {
		serveJSONOk(w, v)
		return
	}

	logf("apiLogEvent: '%s', vals: %#v\n", name, vals)
	logEventFromRequest(r, name, vals, zeroTime)
	serveJSONOk(w, v)
}

func logHttpRequestToWriteDaily(w *WriteDaily, r *http.Request, code int, nWritten int64, dur time.Duration) error {
	ip := getBestIPAddress(r)

	rawQuery := r.URL.RawQuery
	if len(rawQuery) > 128 {
		rawQuery = rawQuery[:128]
	}

	entry := map[string]any{
		"ts":     time.Now().UTC().Unix(),
		"method": r.Method,
		"url":    r.URL.Path,
		"query":  rawQuery,
		"host":   r.Host,
		"ip":     ip,
		"code":   code,
		"size":   nWritten,
		"dur":    float64(dur.Microseconds()) / 1000.0, // milliseconds with decimal precision
	}

	if referer := r.Header.Get("Referer"); referer != "" {
		entry["referer"] = referer
	}
	if ua := r.Header.Get("User-Agent"); ua != "" {
		entry["ua"] = ua
	}
	if contentType := r.Header.Get("Content-Type"); contentType != "" {
		entry["content_type"] = contentType
	}

	buf := &strings.Builder{}
	encoder := json.NewEncoder(buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(entry); err != nil {
		return err
	}

	// Write to log (Encode adds a newline)
	return w.Write([]byte(buf.String()))
}

func logHttpRequest(r *http.Request, code int, nWritten int64, dur time.Duration) error {
	return logHttpRequestToWriteDaily(httpLog, r, code, nWritten, dur)
}

func toStr(a any) string {
	if s, ok := a.(string); ok {
		return s
	}
	return fmt.Sprintf("%s", a)
}
