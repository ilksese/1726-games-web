package web

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ilksese/1726-games-web/packages/server/internal/room"
)

func TestRoomPageAndQRCode(t *testing.T) {
	gameRoom := room.New("123456", "", time.Second)
	handler, err := New(gameRoom, "http://192.168.1.20:5174/room/123456")
	if err != nil {
		t.Fatal(err)
	}

	redirect := httptest.NewRecorder()
	handler.ServeHTTP(redirect, httptest.NewRequest(http.MethodGet, "/", nil))
	if redirect.Code != http.StatusTemporaryRedirect || redirect.Header().Get("Location") != "/room/123456" {
		t.Fatalf("unexpected redirect: %d %s", redirect.Code, redirect.Header().Get("Location"))
	}

	page := httptest.NewRecorder()
	handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/room/123456", nil))
	if page.Code != http.StatusOK || page.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Fatalf("unexpected room page response: %d %s", page.Code, page.Header().Get("Content-Type"))
	}

	qr := httptest.NewRecorder()
	handler.ServeHTTP(qr, httptest.NewRequest(http.MethodGet, "/api/rooms/123456/qr", nil))
	if qr.Code != http.StatusOK || qr.Header().Get("Content-Type") != "image/png" || qr.Body.Len() < 100 {
		t.Fatalf("unexpected qr response: %d %s (%d bytes)", qr.Code, qr.Header().Get("Content-Type"), qr.Body.Len())
	}
}

func TestOnlyCaptainCanStartThroughHTTP(t *testing.T) {
	gameRoom := room.New("123456", "", time.Second)
	handler, err := New(gameRoom, "http://127.0.0.1:5174/room/123456")
	if err != nil {
		t.Fatal(err)
	}

	captainCookie := joinPlayer(t, handler, "甲")
	memberCookie := joinPlayer(t, handler, "乙")

	captainEvents, cancelCaptain, err := gameRoom.Subscribe(captainCookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelCaptain()
	memberEvents, cancelMember, err := gameRoom.Subscribe(memberCookie.Value)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelMember()
	_ = captainEvents
	_ = memberEvents

	request := httptest.NewRequest(http.MethodPost, "/api/rooms/123456/start", nil)
	request.AddCookie(memberCookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("member start status = %d, want 403: %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPost, "/api/rooms/123456/start", nil)
	request.AddCookie(captainCookie)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("captain start status = %d, want 200: %s", response.Code, response.Body.String())
	}
}

func joinPlayer(t *testing.T, handler http.Handler, name string) *http.Cookie {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"name": name})
	request := httptest.NewRequest(http.MethodPost, "/api/rooms/123456/join", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		payload, _ := io.ReadAll(response.Body)
		t.Fatalf("join status = %d: %s", response.Code, payload)
	}
	cookies := response.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("join response did not set a session cookie")
	}
	return cookies[0]
}
