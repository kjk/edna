package server

import (
	"context"
	"fmt"
	"net/http"
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
	logf("sendLogInEmail\n")
	var email, turnstileToken string
	err := getURLParams(r.URL.Query(), "email", &email, "turnstileToken", &turnstileToken)
	if serveJSONIfErr(w, err) {
		return
	}
	// if serveCheckTurnstile(w, r, turnstileToken) {
	// 	return
	// }
	code := createLogInCode(email)
	logf("sendLogInEmail: setLogInCode(%s) => %s\n", email, code)

	mg := mailgun.NewMailgun(mailgunDomain, mailgunAPIKey)

	subject := "Log In code for s3uploadproxy.arslexis.io"
	//signURL := getServerBaseURL() + "/login/" + code
	body := "Your s3uploadproxy.arslexis.io login code: " + code + "\n"
	body += "This code will expire in one hour.\n"
	body += "If you did not request login code, please ignore this email.\n"

	// Send the message with a 10 second timeout
	message := mailgun.NewMessage(emailSender, subject, body, email)
	ctx, cancel := context.WithTimeout(ctx(), time.Second*10)
	defer cancel()
	_, _, err = mg.Send(ctx, message)
	logf("sendLogInEmail: sent email, error: %s\n", err)
	if serveJSONIfErr(w, err) {
		return
	}
	serveJSON(w, nil, http.StatusOK)
	// recordEvent(r, "send_login_email", "user", email)
	// go func() {
	// 	body := "Someone requested log in link for " + email
	// 	notifyMeViaEmail("log in attempt", body, email)
	// }()
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
