package server

import (
	"fmt"

	"github.com/kjk/common/logtastic"
	"github.com/kjk/common/u"
)

// only logs locally so no need to worry about recursive logging calls
func logfLocal(s string, args ...interface{}) {
	if len(args) > 0 {
		s = fmt.Sprintf(s, args...)
	}
	fmt.Print(s)
}

func logf(s string, args ...interface{}) {
	if len(args) > 0 {
		s = fmt.Sprintf(s, args...)
	}
	fmt.Print(s)
	logtastic.Log(s)
}

func logErrorf(format string, args ...interface{}) {
	s := format
	if len(args) > 0 {
		s = fmt.Sprintf(format, args...)
	}
	cs := u.GetCallstack(1)
	s = fmt.Sprintf("Error: %s\n%s\n", s, cs)
	fmt.Print(s)
	logtastic.LogError(nil, s)
}

// return true if there was an error
func logIfErrf(err error, msgAndArgs ...interface{}) bool {
	if err == nil {
		return false
	}
	msg := ""
	if len(msgAndArgs) > 0 {
		// first arg should be a format string but we're playing it safe
		msg = fmt.Sprintf("%s", msgAndArgs)
		if len(msgAndArgs) > 1 {
			msg = fmt.Sprintf(msg, msgAndArgs[1:]...)
		}
	}

	cs := u.GetCallstack(1)
	var s string
	if msg != "" {
		s = fmt.Sprintf("Error: %s\n%s\n%s\n", err, msg, cs)
	} else {
		s = fmt.Sprintf("Error: %s\n%s\n", err, cs)
	}
	fmt.Print(s)
	logtastic.LogError(nil, s)
	return true
}
