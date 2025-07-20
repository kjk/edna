package server

import (
	"math/rand"
	"time"
)

const shortIDSymbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
const symbolsDigit = "0123456789"

var nanoRand = rand.New(rand.NewSource(time.Now().UnixNano()))

func genRandomID(n int) string {
	res := make([]byte, n)
	for i := 0; i < n; i++ {
		idx := nanoRand.Intn(len(shortIDSymbols))
		res[i] = shortIDSymbols[idx]
	}
	return string(res)
}

func genRandomLoginCode(n int) string {
	result := make([]byte, n)
	for i := 0; i < n; i++ {
		x := nanoRand.Intn(len(symbolsDigit) - 1)
		result[i] = symbolsDigit[x]
	}
	return string(result)
}
