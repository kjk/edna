package server

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
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
