package server

import (
	"math/rand"
	"time"
)

const shortIDSymbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"

var nShortSymbols = len(shortIDSymbols)

func genRandomID(n int) string {
	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	res := make([]byte, n)
	for i := 0; i < n; i++ {
		idx := rnd.Intn(nShortSymbols)
		res[i] = shortIDSymbols[idx]
	}
	return string(res)
}
