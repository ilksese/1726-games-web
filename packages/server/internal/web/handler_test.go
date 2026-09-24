package web

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/ilksese/1726-games-web/packages/server/internal/room"
)

func testHandler(t *testing.T) (*room.Room, http.Handler) {
	t.Helper()
	gameRoom := room.New("123456", room.Options{
		GameURLTemplate:     "http://127.0.0.1:5173/{game}",
		ServerURL:           "http://127.0.0.1:5174",
		DisconnectGrace:     time.Second,
		ConfirmationTimeout: time.Second,
	})
	handler, err := New(gameRoom, InviteInfo{
		PrimaryURL: "http://1726-games.local:5174/room/123456",
		IPURL:      "http://192.168.1.20:5174/room/123456",
		MDNSURL:    "http://1726-games.local:5174/room/123456",
	}, []string{"http://127.0.0.1:5173"})
	if err != nil {
		t.Fatal(err)
	}
	return gameRoom, handler
}

func TestRoomPageAndQRCode(t *testing.T) {
	_, handler := testHandler(t)

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
	if strings.Contains(page.Body.String(), "PRIVATE LAN SESSION") || strings.Contains(page.Body.String(), "局域网私密组队房间") {
		t.Fatal("non-core hero introduction should not be rendered")
	}

	qr := httptest.NewRecorder()
	handler.ServeHTTP(qr, httptest.NewRequest(http.MethodGet, "/api/rooms/123456/qr", nil))
	if qr.Code != http.StatusOK || qr.Header().Get("Content-Type") != "image/png" || qr.Body.Len() < 100 {
		t.Fatalf("unexpected qr response: %d %s (%d bytes)", qr.Code, qr.Header().Get("Content-Type"), qr.Body.Len())
	}

	scriptRequest := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	scriptRequest.Header.Set("Origin", "http://127.0.0.1:5174")
	script := httptest.NewRecorder()
	handler.ServeHTTP(script, scriptRequest)
	if script.Code != http.StatusOK || !strings.Contains(script.Header().Get("Content-Type"), "javascript") {
		t.Fatalf("module script status = %d, content type = %q", script.Code, script.Header().Get("Content-Type"))
	}
}

func TestOnlyCaptainCanStartThroughHTTP(t *testing.T) {
	gameRoom, handler := testHandler(t)

	captain := joinPlayer(t, handler, "甲")
	member := joinPlayer(t, handler, "乙")

	_, cancelCaptain, err := gameRoom.Subscribe(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelCaptain()
	_, cancelMember, err := gameRoom.Subscribe(member.Name, member.Key)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelMember()

	request := httptest.NewRequest(http.MethodPost, "/api/rooms/123456/start", nil)
	request.Header.Set("X-Player-Name", member.Name)
	request.Header.Set("X-Player-Key", member.Key)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("member start status = %d, want 403: %s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPost, "/api/rooms/123456/start", nil)
	request.Header.Set("X-Player-Name", captain.Name)
	request.Header.Set("X-Player-Key", captain.Key)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("captain start status = %d, want 200: %s", response.Code, response.Body.String())
	}
}

func TestFullGameFlowThroughHTTP(t *testing.T) {
	gameRoom, handler := testHandler(t)
	captain := joinPlayer(t, handler, "队长")
	member := joinPlayer(t, handler, "队员")

	_, cancelCaptain, err := gameRoom.Subscribe(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelCaptain()
	_, cancelMember, err := gameRoom.Subscribe(member.Name, member.Key)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelMember()

	response := postJSON(t, handler, "/api/rooms/123456/config", captain, map[string]any{
		"total":  6,
		"drinks": 2,
	})
	if response.Code != http.StatusOK {
		t.Fatalf("config status = %d: %s", response.Code, response.Body.String())
	}

	response = postJSON(t, handler, "/api/rooms/123456/start", captain, nil)
	if response.Code != http.StatusOK {
		t.Fatalf("start status = %d: %s", response.Code, response.Body.String())
	}
	response = postJSON(t, handler, "/api/rooms/123456/confirm", captain, map[string]bool{"agree": true})
	if response.Code != http.StatusOK {
		t.Fatalf("captain confirm status = %d: %s", response.Code, response.Body.String())
	}
	response = postJSON(t, handler, "/api/rooms/123456/confirm", member, map[string]bool{"agree": true})
	if response.Code != http.StatusOK {
		t.Fatalf("member confirm status = %d: %s", response.Code, response.Body.String())
	}
	var selection stateResponse
	decodeResponse(t, response, &selection)
	if selection.State.Phase != room.PhaseGameSelect {
		t.Fatalf("phase after confirmation = %s, want %s", selection.State.Phase, room.PhaseGameSelect)
	}

	response = postJSON(t, handler, "/api/rooms/123456/select-game", member, map[string]string{"gameId": room.GameWhoDrinks})
	if response.Code != http.StatusForbidden {
		t.Fatalf("member select status = %d, want 403", response.Code)
	}
	response = postJSON(t, handler, "/api/rooms/123456/select-game", captain, map[string]string{"gameId": room.GameWhoDrinks})
	if response.Code != http.StatusOK {
		t.Fatalf("captain select status = %d: %s", response.Code, response.Body.String())
	}
	var started stateResponse
	decodeResponse(t, response, &started)
	if started.State.Phase != room.PhaseStarted || started.State.GameState == nil {
		t.Fatalf("unexpected started state: %+v", started.State)
	}

	gameRequest := httptest.NewRequest(http.MethodGet, "/api/rooms/123456/game", nil)
	gameRequest.Header.Set("Origin", "http://127.0.0.1:5173")
	gameRequest.Header.Set("X-Player-Name", member.Name)
	gameRequest.Header.Set("X-Player-Key", member.Key)
	gameResponse := httptest.NewRecorder()
	handler.ServeHTTP(gameResponse, gameRequest)
	if gameResponse.Code != http.StatusOK {
		t.Fatalf("game state status = %d: %s", gameResponse.Code, gameResponse.Body.String())
	}
	var gameSession joinResponse
	decodeResponse(t, gameResponse, &gameSession)
	if gameSession.Name != "队员" || gameSession.State.Phase != room.PhaseStarted {
		t.Fatalf("unexpected game session: %+v", gameSession)
	}

	response = postJSON(t, handler, "/api/rooms/123456/game/action", member, room.GameAction{Type: "flip", Index: 0})
	if response.Code != http.StatusOK {
		t.Fatalf("flip status = %d: %s", response.Code, response.Body.String())
	}
}

func TestGameOriginCORS(t *testing.T) {
	_, handler := testHandler(t)
	request := httptest.NewRequest(http.MethodGet, "/api/rooms/123456", nil)
	request.Header.Set("Origin", "http://127.0.0.1:5173")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("state status = %d: %s", response.Code, response.Body.String())
	}
	if response.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:5173" {
		t.Fatalf("missing CORS headers: %#v", response.Header())
	}
}

func joinPlayer(t *testing.T, handler http.Handler, name string) room.Session {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"name": name})
	request := httptest.NewRequest(http.MethodPost, "/api/rooms/123456/join", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("join status = %d: %s", response.Code, response.Body.String())
	}
	var joined joinResponse
	decodeResponse(t, response, &joined)
	if joined.Name == "" || joined.Key == "" {
		t.Fatalf("join response missing identity: %+v", joined)
	}
	return room.Session{Name: joined.Name, Key: joined.Key}
}

func postJSON(t *testing.T, handler http.Handler, path string, player room.Session, body any) *httptest.ResponseRecorder {
	t.Helper()
	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		payload = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(http.MethodPost, path, payload)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Player-Name", player.Name)
	request.Header.Set("X-Player-Key", player.Key)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func decodeResponse(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}
