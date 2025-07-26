package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"strconv"
	"strings"
)

func serveJSON(w http.ResponseWriter, v any, code int) {
	d, err := json.Marshal(v)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(d)
}

func serve200JSONData(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func serve200JSON(w http.ResponseWriter, v any) {
	d, err := json.Marshal(v)
	must(err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(d)
	logIfErrf(err)
}

func serve200Text(w http.ResponseWriter, fmtMsg ...any) {
	msg := fmtSmartNL(fmtMsg...)
	logf(msg)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write([]byte(msg))
	logIfErrf(err)
}

// 304: not modified
func serve304(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotModified)
}

func serve400TextIfError(w http.ResponseWriter, err error, fmtMsg ...any) bool {
	if err == nil {
		return false
	}
	msg := fmtSmartNL(err.Error())
	if len(fmtMsg) > 0 {
		msg = fmtSmartNL(fmtMsg...)
	}
	logErrorf(msg)
	http.Error(w, msg, http.StatusBadRequest)
	return true
}

func serve400Text(w http.ResponseWriter, fmtMsg ...any) {
	msg := fmtSmartNL(fmtMsg...)
	logf(msg)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusBadRequest)
	_, err := w.Write([]byte(msg))
	logIfErrf(err)
}

func serve400JSONIfErr(w http.ResponseWriter, err error, msgFormat ...any) bool {
	if err == nil {
		return false
	}
	v := map[string]any{
		"status": "error",
		"error":  err.Error(),
	}
	msg := fmtSmart(msgFormat...)
	if msg != "" {
		v["message"] = msg
		logf("serveJSONIfErr: Error: '%s', message: '%s'\n", err.Error(), msg)
	} else {
		logf("serveJSONIfErr: '%s'\n", err.Error())
	}
	serveJSON(w, v, http.StatusBadRequest)
	return true
}

func serve401TextIfError(w http.ResponseWriter, err error, fmtMsg ...any) bool {
	if err == nil {
		return false
	}
	msg := fmtSmartNL(err.Error())
	if len(fmtMsg) > 0 {
		msg = fmtSmartNL(fmtMsg...)
	}
	logErrorf(msg)
	http.Error(w, msg, http.StatusUnauthorized)
	return true
}

func serve403Text(w http.ResponseWriter, fmtMsg ...any) {
	msg := fmtSmartNL(fmtMsg...)
	logf(msg)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusForbidden)
	_, err := w.Write([]byte(msg))
	logIfErrf(err)
}

func serve404Text(w http.ResponseWriter, fmtMsg ...any) {
	msg := fmtSmartNL(fmtMsg...)
	logf(msg)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusNotFound)
	_, err := w.Write([]byte(msg))
	logIfErrf(err)
}

func serve404JSON(w http.ResponseWriter, v map[string]any) {
	d, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	w.Write(d)
}

func serve500Text(w http.ResponseWriter, fmtMsg ...any) {
	msg := fmtSmartNL(fmtMsg...)
	logf(msg)
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusInternalServerError)
	_, err := w.Write([]byte(msg))
	logIfErrf(err)
}

func serve500TextIfError(w http.ResponseWriter, err error, fmtMsg ...any) bool {
	if err == nil {
		return false
	}
	msg := fmtSmartNL(err.Error())
	if len(fmtMsg) > 0 {
		msg = fmtSmartNL(fmtMsg...)
	}
	logErrorf("%s", msg)
	http.Error(w, msg, http.StatusInternalServerError)
	return true
}

func serve500Error(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	io.WriteString(w, err.Error())
}

func verifyPOSTRequest(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		logf("verifyPOSTRequest(): must be POST request, is: '%s'", r.Method)
		http.Error(w, "must be POST request", http.StatusBadRequest)
		return false
	}
	return true
}

// https://gist.github.com/dipeshdulal/40aed9c9a55ac356bf45b2eafb08424a#file-fullmapping-go
func getURLParams(urlVals url.Values, args ...any) error {
	if len(args) == 0 || len(args)%2 == 1 {
		return fmt.Errorf("must have even number of args")
	}
	for i := 0; i < len(args); i += 2 {
		name := args[i].(string)
		if !urlVals.Has(name) {
			return fmt.Errorf("missing '%s' url arg", name)
		}
		val := strings.TrimSpace(urlVals.Get(name))
		if val == "" {
			return fmt.Errorf("url arg '%s' is empty", name)
		}
		valParsedOut := args[i+1]
		typ := reflect.TypeOf(valParsedOut)
		td := typ.Elem()
		outElem := reflect.ValueOf(valParsedOut).Elem()
		switch td.Kind() {

		case reflect.String:
			outElem.SetString(val)

		case reflect.Int, reflect.Int16, reflect.Int32, reflect.Int64:
			n, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return fmt.Errorf("url arg '%s' is not an int", name)
			}
			outElem.SetInt(int64(n))

		default:
			return fmt.Errorf("unsupported type '%s'", td.Kind())
		}
	}
	return nil
}

func postWithHeaders(uri string, hdrs map[string]string) (*http.Response, error) {
	req, err := http.NewRequest("POST", uri, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range hdrs {
		req.Header.Add(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	return resp, err
}

func getServerBaseURL() string {
	if isDev() {
		return fmt.Sprintf("http://localhost:%d", httpPort)
	}
	return "https://" + domain
}
