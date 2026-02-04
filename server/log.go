package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
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

type WriteDaily struct {
	Dir         string
	currentDate int // YYYYMMDD format
	file        *os.File
	mu          sync.Mutex
}

func NewWriteDaily(dir string) *WriteDaily {
	return &WriteDaily{
		Dir: dir,
	}
}

func (w *WriteDaily) WriteString(s string) error {
	return w.Write([]byte(s))
}

// dayFromTime converts a time.Time to YYYYMMDD integer format
func dayFromTime(t time.Time) int {
	return t.Year()*10000 + int(t.Month())*100 + t.Day()
}

func (w *WriteDaily) Writer() (io.Writer, error) {
	if w == nil {
		return nil, fmt.Errorf("w is nil")
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	now := time.Now().UTC()
	today := dayFromTime(now)

	if w.file != nil && w.currentDate != today {
		if err := w.close(); err != nil {
			return nil, err
		}
	}

	if w.file == nil {
		dateStr := now.Format("2006-01-02")
		filename := filepath.Join(w.Dir, dateStr+".txt")
		if err := os.MkdirAll(w.Dir, 0755); err != nil {
			return nil, err
		}
		f, err := os.OpenFile(filename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return nil, err
		}
		w.file = f
		w.currentDate = today
	}
	return w.file, nil
}

func (w *WriteDaily) Write(d []byte) error {
	if w == nil {
		return nil
	}
	if wr, err := w.Writer(); err != nil {
		return err
	} else {
		_, err := wr.Write(d)
		return err
	}
}

func (w *WriteDaily) close() error {
	if w.file == nil {
		return nil
	}

	err := w.file.Close()
	w.file = nil
	w.currentDate = 0
	return err
}

func (w *WriteDaily) Close() error {
	if w == nil {
		return nil
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	return w.close()
}

func (w *WriteDaily) Sync() error {
	if w == nil {
		return nil
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file != nil {
		return w.file.Sync()
	}
	return nil
}

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

func logErrorf(s string, args ...any) {
	if len(args) > 0 {
		s = fmt.Sprintf(s, args...)
	}
	cs := getCallstack(1)
	fmt.Printf("%s\n%s\n", s, cs)
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

func handleEvent(w http.ResponseWriter, r *http.Request) {
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

	logf("handleEvent: '%s', vals: %#v\n", name, vals)
	logEventFromRequest(r, name, vals, zeroTime)
	serveJSONOk(w, v)
}

func logHTTPRequestToWriteDaily(w *WriteDaily, r *http.Request, code int, nWritten int64, dur time.Duration) error {
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

func logHTTPRequest(r *http.Request, code int, nWritten int64, dur time.Duration) error {
	return logHTTPRequestToWriteDaily(httpLog, r, code, nWritten, dur)
}

func toStr(a any) string {
	if s, ok := a.(string); ok {
		return s
	}
	return fmt.Sprintf("%s", a)
}
