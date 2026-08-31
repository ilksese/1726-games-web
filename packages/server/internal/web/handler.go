package web

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"github.com/ilksese/1726-games-web/packages/server/internal/room"
	qrcode "github.com/skip2/go-qrcode"
)

const sessionCookieName = "games_room_session"

//go:embed static/index.html static/assets/*
var staticFiles embed.FS

type Handler struct {
	room       *room.Room
	inviteURL  string
	indexHTML  []byte
	qrCodePNG  []byte
	assetFiles http.Handler
}

type joinRequest struct {
	Name string `json:"name"`
}

type confirmRequest struct {
	Agree bool `json:"agree"`
}

type stateResponse struct {
	State     room.Snapshot `json:"state"`
	InviteURL string        `json:"inviteUrl"`
}

type joinResponse struct {
	PlayerID  string        `json:"playerId"`
	State     room.Snapshot `json:"state"`
	InviteURL string        `json:"inviteUrl"`
}

type errorResponse struct {
	Error *room.ActionError `json:"error"`
}

func New(gameRoom *room.Room, inviteURL string) (http.Handler, error) {
	indexHTML, err := staticFiles.ReadFile("static/index.html")
	if err != nil {
		return nil, fmt.Errorf("读取房间页面: %w", err)
	}

	assets, err := fs.Sub(staticFiles, "static/assets")
	if err != nil {
		return nil, fmt.Errorf("读取静态资源: %w", err)
	}

	qrCodePNG, err := qrcode.Encode(inviteURL, qrcode.Medium, 320)
	if err != nil {
		return nil, fmt.Errorf("生成邀请二维码: %w", err)
	}

	h := &Handler{
		room:       gameRoom,
		inviteURL:  inviteURL,
		indexHTML:  indexHTML,
		qrCodePNG:  qrCodePNG,
		assetFiles: http.FileServer(http.FS(assets)),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", h.redirectToRoom)
	mux.HandleFunc("GET /room/{code}", h.serveRoom)
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", h.assetFiles))
	mux.HandleFunc("GET /api/rooms/{code}", h.getState)
	mux.HandleFunc("POST /api/rooms/{code}/join", h.join)
	mux.HandleFunc("POST /api/rooms/{code}/start", h.start)
	mux.HandleFunc("POST /api/rooms/{code}/confirm", h.confirm)
	mux.HandleFunc("POST /api/rooms/{code}/leave", h.leave)
	mux.HandleFunc("GET /api/rooms/{code}/events", h.events)
	mux.HandleFunc("GET /api/rooms/{code}/qr", h.qrCode)
	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /favicon.ico", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	return securityHeaders(mux), nil
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
	writeJSON(w, http.StatusOK, stateResponse{State: h.room.State(), InviteURL: h.inviteURL})
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

	session, state, err := h.room.Join(request.Name, h.sessionToken(r))
	if err != nil {
		writeActionError(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   7 * 24 * 60 * 60,
	})
	writeJSON(w, http.StatusOK, joinResponse{
		PlayerID:  session.PlayerID,
		State:     state,
		InviteURL: h.inviteURL,
	})
}

func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	state, err := h.room.RequestStart(h.sessionToken(r))
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.inviteURL})
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

	state, err := h.room.Confirm(h.sessionToken(r), request.Agree)
	if err != nil {
		writeActionError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.inviteURL})
}

func (h *Handler) leave(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}
	state, err := h.room.Leave(h.sessionToken(r))
	if err != nil {
		writeActionError(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, stateResponse{State: state, InviteURL: h.inviteURL})
}

func (h *Handler) events(w http.ResponseWriter, r *http.Request) {
	if !h.ensureRoom(w, r) {
		return
	}

	events, unsubscribe, err := h.room.Subscribe(h.sessionToken(r))
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
	})
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

func (h *Handler) sessionToken(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return actionError("INVALID_REQUEST", "请求内容格式错误")
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
	case "INVALID_NAME", "INVALID_REQUEST":
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
