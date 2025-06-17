package server

import (
	"sync/atomic"
	"time"
)

type Debouncer struct {
	Timeout      time.Duration
	isDebouncing atomic.Bool
	f            func()
}

func (d *Debouncer) run() {
	// subtle:
	//  - grab and clear f to avoid data races with Debounce
	//  - set isDebouncing to false before calling f() to minimize the possibility
	//    Debounce() not registering function to call
	f := d.f
	d.f = nil
	d.isDebouncing.Store(false)
	f()
}

// Maybe: make f() part of Debouncer? It should always be the same function
func (d *Debouncer) Debounce(f func()) {
	didSwap := d.isDebouncing.CompareAndSwap(false, true)
	if !didSwap {
		// wasn't false => therefore was true, therefore we are already debouncing
		return
	}
	panicIf(d.Timeout == 0, "debounce timeout is 0")
	d.f = f
	time.AfterFunc(d.Timeout, d.run)
}
