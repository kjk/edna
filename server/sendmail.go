package server

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/mailgun/mailgun-go/v4"
)

// https://github.com/mailgun/mailgun-go
var (
	mailgunDomain = ""
	mailgunAPIKey = ""
)

const (
	emailSender = "elaris@arslexis.io"
)

// GET /api/send_login_in_email?email=${email}&turnstileToken=${turnstileToken}
func handleAPISendLogInEmail(w http.ResponseWriter, r *http.Request) {
	logf("handleAPISendLogInEmail\n")
	var email string
	//var turnstileToken string
	//err := getURLParams(r.URL.Query(), "email", &email, "turnstileToken", &turnstileToken)
	err := getURLParams(r.URL.Query(), "email", &email)
	if serve400JSONIfErr(w, err) {
		return
	}
	// if serveCheckTurnstile(w, r, turnstileToken) {
	// 	return
	// }
	code := createLogInCode(email)
	logf("sendLogInEmail: setLogInCode(%s) => %s\n", email, code)

	mg := mailgun.NewMailgun(mailgunDomain, mailgunAPIKey)

	subject := fmt.Sprintf("%s is your login code for Elaris", code)
	signURL := getServerBaseURL() + "/login/" + code
	body := `Your elaris.arslexis.io login code: {code}
This code will expire in one hour.
If you did not request login code, please ignore this email.
or you can login via link: ` + signURL
	body = strings.Replace(body, "{code}", code, 1)
	message := mailgun.NewMessage(emailSender, subject, body, email)
	ctx, cancel := context.WithTimeout(ctx(), time.Second*10)
	defer cancel()
	_, _, err = mg.Send(ctx, message)
	logf("sendLogInEmail: sent email, error: %s\n", err)
	if serve400JSONIfErr(w, err) {
		return
	}
	serve200JSON(w, map[string]any{"status": "ok", "message": "Email sent successfully"})
	// recordEvent(r, "send_login_email", "user", email)
	go func() {
		body := "Someone requested log in link for " + email
		notifyMeViaEmail("log in attempt", body, email)
	}()
}

func sendCrashEmail(errStr string, r *http.Request) {
	// for now e-mail myself about panics in prod
	cs := getCallstack(3)
	uri := ""
	if r != nil {
		uri = r.RequestURI
	}
	body := fmt.Sprintf("we crashed!\nurl: %s\ncallstack:\n%s\n%s\n", uri, cs, errStr)
	notifyMeViaEmail("panic", body, "")
}

func notifyMeViaEmail(subject, body, userEmail string) {
	mg := mailgun.NewMailgun(mailgunDomain, mailgunAPIKey)
	// add unique prefix to make it easy to create a filter for those messages in gmail
	if isDev() {
		subject = "(dev) notif: " + subject
	} else {
		subject = "notif: " + subject
	}
	if userEmail != "" {
		subject += " (" + userEmail + ")"
	}
	recipient := "kkowalczyk@gmail.com"
	message := mailgun.NewMessage(emailSender, subject, body, recipient)
	ctx, cancel := context.WithTimeout(ctx(), time.Second*10)
	defer cancel()
	_, _, err := mg.Send(ctx, message)
	if err != nil {
		logf("notifyMeViaEmail: msg.Send() failed with %s\n", err)
		return
	}
	logf("notifyMeViaEmail: sent email, subject '%s'\n", subject)
}
