package web

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ilksese/1726-games-web/packages/server/internal/room"
	qrcode "github.com/skip2/go-qrcode"
)

const (
	playerNameHeader = "X-Player-Name"
	playerKeyHeader  = "X-Player-Key"
)

//go:embed static/index.html static/assets/*
var staticFiles embed.FS

type InviteInfo struct {
	PrimaryURL string `json:"primary"`
	IPURL      string `json:"ip,omitempty"`
	MDNSURL    string `json:"mdns,omitempty"`
}

type Handler struct {
	room           *room.Room
	invites        InviteInfo
	indexHTML      []byte
	qrCodePNG      []byte
	assetFiles     http.Handler
	allowedOrigins map[string]struct{}
}

type joinRequest struct {
	Name string `json:"name"`
	Key  string `json:"key,omitempty"`
}

type confirmRequest struct {
	Agree bool `json:"agree"`
}

type selectGameRequest struct {
	GameID string `json:"gameId"`
}

type stateResponse struct {
	State     room.Snapshot `json:"state"`
	InviteURL string        `json:"inviteUrl"`
	Invites   InviteInfo    `json:"invites"`
}

type joinResponse struct {
	Name      string        `json:"name"`
	Key       string        `json:"key"`
	State     room.Snapshot `json:"state"`
	InviteURL string        `json:"inviteUrl"`
	Invites   InviteInfo    `json:"invites"`
}

type errorResponse struct {
	Error *room.ActionError `json:"error"`
}

func New(gameRoom *room.Room, invites InviteInfo, allowedOrigins []string) (http.Handler, error) {
	indexHTML, err := staticFiles.ReadFile("static/index.html")
	if err != nil {
		return nil, fmt.Errorf("读取房间页面: %w", err)
	}

	assets, err := fs.Sub(staticFiles, "static/assets")
	if err != nil {
		return nil, fmt.Errorf("读取静态资源: %w", err)
	}

	qrCodePNG, err := qrcode.Encode(invites.PrimaryURL, qrcode.Medium, 320)
	if err != nil {
		return nil, fmt.Errorf("生成邀请二维码: %w", err)
	}

	origins := make(map[string]struct{}, len(allowedOrigins)+1)
	for _, origin := range allowedOrigins {
		if normalized := normalizeOrigin(origin); normalized != "" {
			origins[normalized] = struct{}{}
		}
	}
	for _, inviteURL := range []string{invites.PrimaryURL, invites.IPURL, invites.MDNSURL} {
		if inviteOrigin := originOf(inviteURL); inviteOrigin != "" {
			origins[inviteOrigin] = struct{}{}
		}
	}

	h := &Handler{
		room:           gameRoom,
		invites:        invites,
		indexHTML:      indexHTML,
		qrCodePNG:      qrCodePNG,
		assetFiles:     http.FileServer(http.FS(assets)),
		allowedOrigins: origins,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", h.redirectToRoom)
	mux.HandleFunc("GET /room/{code}", h.serveRoom)
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", h.assetFiles))
	mux.HandleFunc("GET /api/rooms/{code}", h.getState)
	mux.HandleFunc("GET /api/rooms/{code}/game", h.getGame)
	mux.HandleFunc("POST /api/rooms/{code}/join", h.join)
	mux.HandleFunc("POST /api/rooms/{code}/config", h.setConfig)
	mux.HandleFunc("POST /api/rooms/{code}/start", h.start)
	mux.HandleFunc("POST /api/rooms/{code}/cancel-start", h.cancelStart)
	mux.HandleFunc("POST /api/rooms/{code}/confirm", h.confirm)
	mux.HandleFunc("POST /api/rooms/{code}/select-game", h.selectGame)
	mux.HandleFunc("POST /api/rooms/{code}/game/action", h.gameAction)
	mux.HandleFunc("POST /api/rooms/{code}/reopen", h.reopen)
	mux.HandleFunc("POST /api/rooms/{code}/leave", h.leave)
	mux.HandleFunc("GET /api/rooms/{code}/events", h.events)
	mux.HandleFunc("GET /api/rooms/{code}/qr", h.qrCode)
	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /favicon.ico", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	return securityHeaders(h.withCORS(mux)), nil
}

func (h *Handler) redirectToRoom(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/room/"+h.room.Code(), http.StatusTemporaryRedirect)
}

func (h *Handler) serveRoom(w http.ResponseWriter, r *http.Request) {
	if !h.matchesRoom(r) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(h.indexHTML)
}

func (h *Handler) getState(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	writeJSON(w, http.StatusOK, h.stateResponse())
}

func (h *Handler) getGame(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	playerName, playerKey := h.playerIdentity(r)
	if _, err := h.room.CurrentPlayer(playerName, playerKey); err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, joinResponse{
		Name:      playerName,
		Key:       playerKey,
		State:     h.room.State(),
		InviteURL: h.invites.PrimaryURL,
		Invites:   h.invites,
	})
}

func (h *Handler) join(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	var request joinRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeActionError(w, err)
		return
	}

	session, state, err := h.room.Join(request.Name, request.Key)
	if err != nil {
		writeActionError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, joinResponse{
		Name:      session.Name,
		Key:       session.Key,
		State:     state,
		InviteURL: h.invites.PrimaryURL,
		Invites:   h.invites,
	})
}

func (h *Handler) setConfig(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	var config room.WhoDrinksConfig
	if err := decodeJSON(w, r, &config); err != nil {
		writeActionError(w, err)
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.SetConfig(name, key, config)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.RequestStart(name, key)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) cancelStart(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.CancelStart(name, key)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) confirm(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	var request confirmRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeActionError(w, err)
		return
	}

	name, key := h.playerIdentity(r)
	state, err := h.room.Confirm(name, key, request.Agree)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) selectGame(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	var request selectGameRequest
	if err := decodeJSON(w, r, &request); err != nil {
		writeActionError(w, err)
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.SelectGame(name, key, request.GameID)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) gameAction(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	var action room.GameAction
	if err := decodeJSON(w, r, &action); err != nil {
		writeActionError(w, err)
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.ApplyGameAction(name, key, action)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) reopen(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.Reopen(name, key)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) leave(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	name, key := h.playerIdentity(r)
	state, err := h.room.Leave(name, key)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.invites.PrimaryURL, Invites: h.invites})
}

func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	name, key := h.playerIdentity(r)
	events, unsubscribe, err := h.room.Subscribe(name, key)
	if err != nil {
		writeActionError(w, err)
		return
	}
	defer unsubscribe()

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeActionError(w, actionError("STREAM_UNAVAILABLE", "当前连接不支持实时房间状态"))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	keepAlive := time.NewTicker(15 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case event := <-events:
			payload, marshalErr := json.Marshal(event)
			if marshalErr != nil {
				return
			}
			if _, writeErr := fmt.Fprintf(w, "data: %s\n\n", payload); writeErr != nil {
				return
			}
			flusher.Flush()
		case <-keepAlive.C:
			if _, writeErr := fmt.Fprint(w, ": ping\n\n"); writeErr != nil {
				return
			}
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (h *Handler) qrCode(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Disposition", "inline; filename=room-"+h.room.Code()+".png")
	_, _ = w.Write(h.qrCodePNG)
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	state := h.room.State()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ok",
		"roomCode": state.Code,
		"phase":    state.Phase,
		"mdnsUrl":  h.invites.MDNSURL,
	})
}

func (h *Handler) stateResponse() stateResponse {
	return stateResponse{State: h.room.State(), InviteURL: h.invites.PrimaryURL, Invites: h.invites}
}

func (h *Handler) matchesRoom(r *http.Request) bool {
	return r.PathValue("code") == h.room.Code()
}

func (h *Handler) ensureRoom(w http.ResponseWriter, r *http.Request) bool {
	if h.matchesRoom(r) {
		return true
	}
	writeJSON(w, http.StatusNotFound, errorResponse{Error: actionError("ROOM_NOT_FOUND", "房间不存在")})
	return false
}

func (h *Handler) playerIdentity(r *http.Request) (string, string) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	key := strings.TrimSpace(r.URL.Query().Get("key"))
	if name == "" {
		name = strings.TrimSpace(r.Header.Get(playerNameHeader))
	}
	if key == "" {
		key = strings.TrimSpace(r.Header.Get(playerKeyHeader))
	}
	return name, key
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return actionError("INVALID_REQUEST", "请求内容格式错误")
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return actionError("INVALID_REQUEST", "请求内容只能包含一个 JSON 对象")
	}
	return nil
}

func writeActionError(w http.ResponseWriter, err error) {
	var actionErr *room.ActionError
	if !errors.As(err, &actionErr) {
		actionErr = actionError("INTERNAL_ERROR", "服务器暂时无法处理请求")
	}

	status := http.StatusConflict
	switch actionErr.Code {
	case "INVALID_NAME", "INVALID_REQUEST", "INVALID_GAME_CONFIG", "INVALID_CARD", "UNKNOWN_GAME_ACTION", "NAME_TAKEN":
		status = http.StatusBadRequest
	case "UNAUTHORIZED":
		status = http.StatusUnauthorized
	case "NOT_CAPTAIN", "NOT_PARTICIPANT":
		status = http.StatusForbidden
	case "ROOM_NOT_FOUND":
		status = http.StatusNotFound
	case "INTERNAL_ERROR", "STREAM_UNAVAILABLE":
		status = http.StatusInternalServerError
	}
	writeJSON(w, status, errorResponse{Error: actionErr})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func actionError(code, message string) *room.ActionError {
	return &room.ActionError{Code: code, Message: message}
}

func normalizeOrigin(value string) string {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func originOf(value string) string {
	return normalizeOrigin(value)
}

func (h *Handler) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" {
			normalized := normalizeOrigin(origin)
			_, explicitlyAllowed := h.allowedOrigins[normalized]
			if normalized != requestOrigin(r) && !explicitlyAllowed {
				writeJSON(w, http.StatusForbidden, errorResponse{Error: actionError("ORIGIN_NOT_ALLOWED", "当前来源不允许访问房间服务")})
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Headers", "content-type, x-player-name, x-player-key")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
			w.Header().Add("Vary", "Origin")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		} else if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requestOrigin(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); forwarded == "http" || forwarded == "https" {
		scheme = forwarded
	}
	return scheme + "://" + r.Host
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}
