package room

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

type Phase string

const (
	PhaseWaiting    Phase = "waiting"
	PhaseConfirming Phase = "confirming"
	PhaseStarted    Phase = "started"
)

type ActionError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ActionError) Error() string {
	return e.Message
}

type Session struct {
	PlayerID string `json:"playerId"`
	Token    string `json:"token"`
}

type PlayerView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Captain   bool   `json:"captain"`
	Connected bool   `json:"connected"`
	Confirmed bool   `json:"confirmed"`
}

type ConfirmationView struct {
	Accepted int `json:"accepted"`
	Total    int `json:"total"`
}

type Snapshot struct {
	Code         string           `json:"code"`
	Phase        Phase            `json:"phase"`
	Revision     uint64           `json:"revision"`
	Players      []PlayerView     `json:"players"`
	Confirmation ConfirmationView `json:"confirmation"`
	GameURL      string           `json:"gameUrl,omitempty"`
}

type Event struct {
	Type    string   `json:"type"`
	State   Snapshot `json:"state"`
	Message string   `json:"message,omitempty"`
}

type player struct {
	id                   string
	token                string
	name                 string
	captain              bool
	connected            bool
	confirmed            bool
	connections          int
	disconnectGeneration uint64
}

type Room struct {
	mu              sync.Mutex
	code            string
	gameURL         string
	disconnectGrace time.Duration
	phase           Phase
	revision        uint64
	players         map[string]*player
	tokenIndex      map[string]string
	order           []string
	participants    map[string]struct{}
	subscribers     map[chan Event]struct{}
}

func New(code, gameURL string, disconnectGrace time.Duration) *Room {
	if disconnectGrace <= 0 {
		disconnectGrace = 20 * time.Second
	}

	return &Room{
		code:            code,
		gameURL:         gameURL,
		disconnectGrace: disconnectGrace,
		phase:           PhaseWaiting,
		players:         make(map[string]*player),
		tokenIndex:      make(map[string]string),
		participants:    make(map[string]struct{}),
		subscribers:     make(map[chan Event]struct{}),
	}
}

func (r *Room) Code() string {
	return r.code
}

func (r *Room) State() Snapshot {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.snapshotLocked()
}

// Join creates a player session, or resumes an existing session when token is valid.
func (r *Room) Join(name, token string) (Session, Snapshot, error) {
	cleanName, err := normalizeName(name)
	if err != nil {
		return Session{}, Snapshot{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if token != "" {
		if playerID, ok := r.tokenIndex[token]; ok {
			p := r.players[playerID]
			if p.name != cleanName {
				oldName := p.name
				p.name = cleanName
				r.revision++
				r.broadcastLocked("player_updated", fmt.Sprintf("%s 将昵称改为 %s", oldName, cleanName))
			}
			return Session{PlayerID: p.id, Token: p.token}, r.snapshotLocked(), nil
		}
	}

	if r.phase != PhaseWaiting {
		return Session{}, Snapshot{}, actionError("ROOM_LOCKED", "房间正在确认或游戏已经开始，暂时不能加入")
	}

	id, err := randomCredential(9)
	if err != nil {
		return Session{}, Snapshot{}, fmt.Errorf("生成玩家标识: %w", err)
	}
	token, err = randomCredential(24)
	if err != nil {
		return Session{}, Snapshot{}, fmt.Errorf("生成会话令牌: %w", err)
	}

	p := &player{
		id:      "p_" + id,
		token:   token,
		name:    cleanName,
		captain: len(r.order) == 0,
	}
	r.players[p.id] = p
	r.tokenIndex[p.token] = p.id
	r.order = append(r.order, p.id)
	r.revision++

	message := fmt.Sprintf("%s 加入了房间", p.name)
	if p.captain {
		message = fmt.Sprintf("%s 成为队长", p.name)
	}
	r.broadcastLocked("player_joined", message)

	return Session{PlayerID: p.id, Token: p.token}, r.snapshotLocked(), nil
}

func (r *Room) Leave(token string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByTokenLocked(token)
	if err != nil {
		return Snapshot{}, err
	}

	if r.phase == PhaseConfirming {
		r.cancelConfirmationLocked()
	}

	name := p.name
	wasCaptain := p.captain
	r.removePlayerLocked(p.id)
	r.revision++

	message := fmt.Sprintf("%s 离开了房间", name)
	if wasCaptain {
		if captain := r.captainLocked(); captain != nil {
			message = fmt.Sprintf("%s 离开了房间，%s 成为新队长", name, captain.name)
		}
	}
	r.broadcastLocked("player_left", message)
	return r.snapshotLocked(), nil
}

func (r *Room) RequestStart(token string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByTokenLocked(token)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以开启游戏")
	}
	if r.phase == PhaseStarted {
		return Snapshot{}, actionError("GAME_ALREADY_STARTED", "游戏已经开始")
	}
	if r.phase == PhaseConfirming {
		return Snapshot{}, actionError("CONFIRMATION_IN_PROGRESS", "开局确认已经发起")
	}
	if len(r.order) == 0 {
		return Snapshot{}, actionError("NO_PLAYERS", "房间内没有玩家")
	}

	for _, playerID := range r.order {
		member := r.players[playerID]
		if !member.connected {
			return Snapshot{}, actionError("PLAYER_OFFLINE", fmt.Sprintf("%s 当前离线，请等待其重连或离开房间", member.name))
		}
	}

	r.phase = PhaseConfirming
	r.participants = make(map[string]struct{}, len(r.order))
	for _, playerID := range r.order {
		member := r.players[playerID]
		member.confirmed = false
		r.participants[playerID] = struct{}{}
	}
	r.revision++
	r.broadcastLocked("confirmation_requested", fmt.Sprintf("队长 %s 发起了开局确认", p.name))
	return r.snapshotLocked(), nil
}

func (r *Room) Confirm(token string, agreed bool) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByTokenLocked(token)
	if err != nil {
		return Snapshot{}, err
	}
	if r.phase != PhaseConfirming {
		return Snapshot{}, actionError("NOT_CONFIRMING", "当前没有待确认的开局请求")
	}
	if _, ok := r.participants[p.id]; !ok {
		return Snapshot{}, actionError("NOT_PARTICIPANT", "你不在本次开局确认名单中")
	}

	if !agreed {
		name := p.name
		r.cancelConfirmationLocked()
		r.revision++
		r.broadcastLocked("confirmation_cancelled", fmt.Sprintf("%s 暂不同意开始，已取消本次开局", name))
		return r.snapshotLocked(), nil
	}

	if !p.confirmed {
		p.confirmed = true
		r.revision++
	}

	if r.allConfirmedLocked() {
		r.phase = PhaseStarted
		r.broadcastLocked("game_started", "所有玩家均已同意，游戏开始")
		return r.snapshotLocked(), nil
	}

	r.broadcastLocked("confirmation_updated", fmt.Sprintf("%s 已同意开始", p.name))
	return r.snapshotLocked(), nil
}

// Subscribe authenticates an SSE connection and returns a stream of room events.
func (r *Room) Subscribe(token string) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByTokenLocked(token)
	if err != nil {
		return nil, nil, err
	}

	ch := make(chan Event, 8)
	r.subscribers[ch] = struct{}{}

	wasDisconnected := p.connections == 0
	p.connections++
	p.disconnectGeneration++
	if wasDisconnected {
		p.connected = true
		r.revision++
		r.broadcastLocked("player_connected", fmt.Sprintf("%s 已上线", p.name))
	} else {
		r.offerLocked(ch, Event{Type: "state", State: r.snapshotLocked()})
	}

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			r.unsubscribe(p.id, ch)
		})
	}
	return ch, cancel, nil
}

func (r *Room) unsubscribe(playerID string, ch chan Event) {
	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.subscribers, ch)
	p, ok := r.players[playerID]
	if !ok || p.connections == 0 {
		return
	}

	p.connections--
	if p.connections > 0 {
		return
	}

	p.connected = false
	p.disconnectGeneration++
	generation := p.disconnectGeneration
	message := fmt.Sprintf("%s 已离线，等待重连", p.name)
	eventType := "player_disconnected"
	if r.phase == PhaseConfirming {
		if _, participant := r.participants[p.id]; participant {
			r.cancelConfirmationLocked()
			message = fmt.Sprintf("%s 已离线，本次开局确认已取消", p.name)
			eventType = "confirmation_cancelled"
		}
	}
	r.revision++
	r.broadcastLocked(eventType, message)

	time.AfterFunc(r.disconnectGrace, func() {
		r.removeIfStillDisconnected(playerID, generation)
	})
}

func (r *Room) removeIfStillDisconnected(playerID string, generation uint64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.players[playerID]
	if !ok || p.connections > 0 || p.disconnectGeneration != generation {
		return
	}

	name := p.name
	wasCaptain := p.captain
	r.removePlayerLocked(playerID)
	r.revision++
	message := fmt.Sprintf("%s 长时间离线，已移出房间", name)
	if wasCaptain {
		if captain := r.captainLocked(); captain != nil {
			message = fmt.Sprintf("%s 长时间离线，%s 成为新队长", name, captain.name)
		}
	}
	r.broadcastLocked("player_removed", message)
}

func (r *Room) playerByTokenLocked(token string) (*player, error) {
	if token == "" {
		return nil, actionError("UNAUTHORIZED", "玩家会话无效，请重新加入房间")
	}
	playerID, ok := r.tokenIndex[token]
	if !ok {
		return nil, actionError("UNAUTHORIZED", "玩家会话已失效，请重新加入房间")
	}
	p, ok := r.players[playerID]
	if !ok {
		return nil, actionError("UNAUTHORIZED", "玩家会话已失效，请重新加入房间")
	}
	return p, nil
}

func (r *Room) removePlayerLocked(playerID string) {
	p, ok := r.players[playerID]
	if !ok {
		return
	}
	delete(r.players, playerID)
	delete(r.tokenIndex, p.token)
	delete(r.participants, playerID)

	for i, id := range r.order {
		if id == playerID {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}

	if p.captain && len(r.order) > 0 {
		r.players[r.order[0]].captain = true
	}
	if len(r.order) == 0 {
		r.phase = PhaseWaiting
		r.participants = make(map[string]struct{})
	}
}

func (r *Room) captainLocked() *player {
	for _, playerID := range r.order {
		if p := r.players[playerID]; p != nil && p.captain {
			return p
		}
	}
	return nil
}

func (r *Room) cancelConfirmationLocked() {
	r.phase = PhaseWaiting
	r.participants = make(map[string]struct{})
	for _, p := range r.players {
		p.confirmed = false
	}
}

func (r *Room) allConfirmedLocked() bool {
	if len(r.participants) == 0 {
		return false
	}
	for playerID := range r.participants {
		p, ok := r.players[playerID]
		if !ok || !p.confirmed {
			return false
		}
	}
	return true
}

func (r *Room) snapshotLocked() Snapshot {
	players := make([]PlayerView, 0, len(r.order))
	accepted := 0
	for _, playerID := range r.order {
		p := r.players[playerID]
		if p == nil {
			continue
		}
		if _, participating := r.participants[playerID]; participating && p.confirmed {
			accepted++
		}
		players = append(players, PlayerView{
			ID:        p.id,
			Name:      p.name,
			Captain:   p.captain,
			Connected: p.connected,
			Confirmed: p.confirmed,
		})
	}

	return Snapshot{
		Code:     r.code,
		Phase:    r.phase,
		Revision: r.revision,
		Players:  players,
		Confirmation: ConfirmationView{
			Accepted: accepted,
			Total:    len(r.participants),
		},
		GameURL: r.gameURL,
	}
}

func (r *Room) broadcastLocked(eventType, message string) {
	event := Event{Type: eventType, State: r.snapshotLocked(), Message: message}
	for ch := range r.subscribers {
		r.offerLocked(ch, event)
	}
}

func (r *Room) offerLocked(ch chan Event, event Event) {
	select {
	case ch <- event:
		return
	default:
	}

	select {
	case <-ch:
	default:
	}

	select {
	case ch <- event:
	default:
	}
}

func normalizeName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", actionError("INVALID_NAME", "请输入玩家昵称")
	}
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) > 20 {
		return "", actionError("INVALID_NAME", "玩家昵称不能超过 20 个字符")
	}
	for _, char := range name {
		if unicode.IsControl(char) {
			return "", actionError("INVALID_NAME", "玩家昵称不能包含控制字符")
		}
	}
	return name, nil
}

func randomCredential(size int) (string, error) {
	buffer := make([]byte, size)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func actionError(code, message string) *ActionError {
	return &ActionError{Code: code, Message: message}
}
