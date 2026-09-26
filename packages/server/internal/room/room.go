package room

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"math/big"
	"net/url"
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
	PhaseGameSelect Phase = "game-select"
	PhaseStarted    Phase = "started"
	PhaseFinished   Phase = "finished"
)

const (
	GameWhoDrinks       = "who-drinks"
	GameWanxiangMahjong = "wanxiang-mahjong"
	MaxRoomPlayers      = 12
	wanxiangHandSize    = 3
	wanxiangRounds      = 5
	wanxiangVoteTimeout = 5 * time.Second
)

type ActionError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *ActionError) Error() string {
	return e.Message
}

type Session struct {
	Name string `json:"name"`
	Key  string `json:"key"`
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

type GameOption struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MinPlayers  int    `json:"minPlayers"`
	MaxPlayers  int    `json:"maxPlayers"`
}

type GameSelection struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WhoDrinksConfig struct {
	Total  int `json:"total"`
	Drinks int `json:"drinks"`
}

type RevealedCard struct {
	Index     int    `json:"index"`
	Kind      string `json:"kind"`
	ActorID   string `json:"actorId"`
	ActorName string `json:"actorName"`
}

type GameActionView struct {
	ID        uint64 `json:"id"`
	Type      string `json:"type"`
	Index     int    `json:"index"`
	Kind      string `json:"kind,omitempty"`
	ActorID   string `json:"actorId,omitempty"`
	ActorName string `json:"actorName,omitempty"`
}

type WhoDrinksState struct {
	Round           int             `json:"round"`
	Total           int             `json:"total"`
	Drinks          int             `json:"drinks"`
	RemainingDrinks int             `json:"remainingDrinks"`
	Revealed        []RevealedCard  `json:"revealed"`
	Locked          bool            `json:"locked"`
	LastAction      *GameActionView `json:"lastAction,omitempty"`
}

type Snapshot struct {
	Code           string           `json:"code"`
	Phase          Phase            `json:"phase"`
	Revision       uint64           `json:"revision"`
	Players        []PlayerView     `json:"players"`
	Confirmation   ConfirmationView `json:"confirmation"`
	Config         WhoDrinksConfig  `json:"config"`
	AvailableGames []GameOption     `json:"availableGames"`
	SelectedGame   *GameSelection   `json:"selectedGame,omitempty"`
	GameURL        string           `json:"gameUrl,omitempty"`
	GameState      *WhoDrinksState  `json:"gameState,omitempty"`
	Wanxiang       *WanxiangState   `json:"wanxiang,omitempty"`
}

type Event struct {
	Type    string   `json:"type"`
	State   Snapshot `json:"state"`
	Message string   `json:"message,omitempty"`
}

type GameAction struct {
	Type      string `json:"type"`
	Index     int    `json:"index"`
	Nominee   string `json:"nominee,omitempty"`
	Agree     *bool  `json:"agree,omitempty"`
	HandIndex int    `json:"handIndex,omitempty"`
}

type WanxiangSeatView struct {
	Name      string `json:"name"`
	Score     int    `json:"score"`
	HandCount int    `json:"handCount"`
}

type WanxiangPlayedCard struct {
	SkillID string `json:"skillId"`
	Player  string `json:"player"`
}

type WanxiangVoteView struct {
	Kind      string   `json:"kind"`
	Proposer  string   `json:"proposer"`
	Nominee   string   `json:"nominee,omitempty"`
	OpenedAt  int64    `json:"openedAt"`
	ExpiresAt int64    `json:"expiresAt"`
	Agreed    []string `json:"agreed"`
	Pending   []string `json:"pending"`
}

// WanxiangState is the public broadcast view. Hands stay server-side;
// clients read their own cards from OwnHand / GET /game/hand.
type WanxiangState struct {
	Round     int                   `json:"round"`
	Pool      int                   `json:"pool"`
	Seats     []WanxiangSeatView    `json:"seats"`
	Played    []WanxiangPlayedCard  `json:"played"`
	Vote      *WanxiangVoteView     `json:"vote,omitempty"`
}

type WanxiangHand struct {
	Cards []string `json:"cards"`
}

type Options struct {
	GameURLTemplate     string
	ServerURL           string
	DisconnectGrace     time.Duration
	ConfirmationTimeout time.Duration
}

type player struct {
	name                 string
	key                  string
	captain              bool
	connected            bool
	confirmed            bool
	connections          int
	disconnectGeneration uint64
}

type whoDrinksGame struct {
	round           int
	config          WhoDrinksConfig
	deck            []string
	revealed        map[int]RevealedCard
	locked          bool
	nextActionID    uint64
	lastAction      *GameActionView
	remainingDrinks int
}

type wanxiangSeat struct {
	name  string
	score int
	hand  []string
}

type wanxiangVote struct {
	kind     string
	proposer string
	nominee  string
	openedAt time.Time
	agreed   map[string]struct{}
	timer    *time.Timer
}

type wanxiangGame struct {
	round          int
	pool           []string
	order          []string
	seats          map[string]*wanxiangSeat
	played         []WanxiangPlayedCard
	vote           *wanxiangVote
	voteGeneration uint64
}

type Room struct {
	mu                     sync.Mutex
	code                   string
	gameURLTemplate        string
	serverURL              string
	disconnectGrace        time.Duration
	confirmationTimeout    time.Duration
	confirmationTimer      *time.Timer
	confirmationGeneration uint64
	phase                  Phase
	revision               uint64
	config                 WhoDrinksConfig
	selectedGame           *GameSelection
	whoDrinks              *whoDrinksGame
	wanxiang               *wanxiangGame
	players                map[string]*player
	order                  []string
	participants           map[string]struct{}
	subscribers            map[chan Event]struct{}
}

func New(code string, options Options) *Room {
	if options.DisconnectGrace <= 0 {
		options.DisconnectGrace = 20 * time.Second
	}
	if options.ConfirmationTimeout <= 0 {
		options.ConfirmationTimeout = 60 * time.Second
	}
	if options.GameURLTemplate == "" {
		options.GameURLTemplate = "/who-drinks"
	}

	return &Room{
		code:                code,
		gameURLTemplate:     options.GameURLTemplate,
		serverURL:           strings.TrimRight(options.ServerURL, "/"),
		disconnectGrace:     options.DisconnectGrace,
		confirmationTimeout: options.ConfirmationTimeout,
		phase:               PhaseWaiting,
		config:              WhoDrinksConfig{Total: 12, Drinks: 3},
		players:             make(map[string]*player),
		participants:        make(map[string]struct{}),
		subscribers:         make(map[chan Event]struct{}),
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

func (r *Room) CurrentPlayer(name, key string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return "", err
	}
	return p.name, nil
}

func (r *Room) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.stopConfirmationTimerLocked()
	for subscriber := range r.subscribers {
		delete(r.subscribers, subscriber)
	}
}

// Join adds a uniquely named player. An existing name is rejected unless key matches that seat.
func (r *Room) Join(name, key string) (Session, Snapshot, error) {
	cleanName, err := normalizeName(name)
	if err != nil {
		return Session{}, Snapshot{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if existing, exists := r.players[cleanName]; exists {
		if key == "" || key != existing.key {
			return Session{}, Snapshot{}, actionError("NAME_TAKEN", "这个名字已经在房间里，请换一个")
		}
		return Session{Name: existing.name, Key: existing.key}, r.snapshotLocked(), nil
	}
	if r.phase != PhaseWaiting {
		return Session{}, Snapshot{}, actionError("ROOM_LOCKED", "房间正在确认或游戏已经开始，暂时不能加入")
	}
	if len(r.order) >= MaxRoomPlayers {
		return Session{}, Snapshot{}, actionError("ROOM_FULL", fmt.Sprintf("房间已达到 %d 人上限", MaxRoomPlayers))
	}

	seatKey, err := randomKey()
	if err != nil {
		return Session{}, Snapshot{}, fmt.Errorf("生成玩家钥匙: %w", err)
	}
	p := &player{
		name:    cleanName,
		key:     seatKey,
		captain: len(r.order) == 0,
	}
	r.players[cleanName] = p
	r.order = append(r.order, cleanName)
	r.revision++

	message := fmt.Sprintf("%s 加入了房间", p.name)
	if p.captain {
		message = fmt.Sprintf("%s 成为队长", p.name)
	}
	r.broadcastLocked("player_joined", message)

	return Session{Name: cleanName, Key: seatKey}, r.snapshotLocked(), nil
}

func (r *Room) Leave(name, key string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}

	if r.phase == PhaseConfirming {
		r.cancelConfirmationLocked()
	}

	playerName := p.name
	wasCaptain := p.captain
	r.removePlayerLocked(p.name)
	r.revision++

	message := fmt.Sprintf("%s 离开了房间", playerName)
	if wasCaptain {
		if captain := r.captainLocked(); captain != nil {
			message = fmt.Sprintf("%s 离开了房间，%s 成为新队长", playerName, captain.name)
		}
	}
	r.broadcastLocked("player_left", message)
	return r.snapshotLocked(), nil
}

func (r *Room) SetConfig(name, key string, config WhoDrinksConfig) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以修改游戏配置")
	}
	if r.phase != PhaseWaiting {
		return Snapshot{}, actionError("CONFIG_LOCKED", "开局流程已经开始，不能再修改配置")
	}
	cleanConfig, err := validateWhoDrinksConfig(config)
	if err != nil {
		return Snapshot{}, err
	}
	if r.config == cleanConfig {
		return r.snapshotLocked(), nil
	}

	r.config = cleanConfig
	r.revision++
	r.broadcastLocked("config_updated", fmt.Sprintf("队长将配置调整为 %d 张牌、%d 杯酒", cleanConfig.Total, cleanConfig.Drinks))
	return r.snapshotLocked(), nil
}

func (r *Room) RequestStart(name, key string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以开启游戏")
	}
	if r.phase == PhaseStarted {
		return Snapshot{}, actionError("GAME_ALREADY_STARTED", "游戏已经开始")
	}
	if r.phase == PhaseFinished {
		return Snapshot{}, actionError("GAME_FINISHED", "当前游戏已经结束，请先重新开启房间")
	}
	if r.phase == PhaseConfirming || r.phase == PhaseGameSelect {
		return Snapshot{}, actionError("START_FLOW_IN_PROGRESS", "当前开局流程已经发起")
	}
	if len(r.order) < 2 {
		return Snapshot{}, actionError("NOT_ENOUGH_PLAYERS", "至少需要 2 名玩家才能开始组队游戏")
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
	r.stopConfirmationTimerLocked()
	r.confirmationGeneration++
	generation := r.confirmationGeneration
	r.confirmationTimer = time.AfterFunc(r.confirmationTimeout, func() {
		r.expireConfirmation(generation)
	})
	r.revision++
	r.broadcastLocked("confirmation_requested", fmt.Sprintf("队长 %s 发起了开局确认", p.name))
	return r.snapshotLocked(), nil
}

func (r *Room) Confirm(name, key string, agreed bool) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if r.phase != PhaseConfirming {
		return Snapshot{}, actionError("NOT_CONFIRMING", "当前没有待确认的开局请求")
	}
	if _, ok := r.participants[p.name]; !ok {
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
		r.stopConfirmationTimerLocked()
		r.phase = PhaseGameSelect
		r.broadcastLocked("confirmation_completed", "所有玩家均已同意，请队长选择游戏")
		return r.snapshotLocked(), nil
	}

	r.broadcastLocked("confirmation_updated", fmt.Sprintf("%s 已同意开始", p.name))
	return r.snapshotLocked(), nil
}

func (r *Room) CancelStart(name, key string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以取消开局流程")
	}
	if r.phase != PhaseConfirming && r.phase != PhaseGameSelect {
		return Snapshot{}, actionError("NO_START_FLOW", "当前没有可取消的开局流程")
	}

	r.cancelConfirmationLocked()
	r.revision++
	r.broadcastLocked("start_cancelled", fmt.Sprintf("队长 %s 取消了开局流程", p.name))
	return r.snapshotLocked(), nil
}

func (r *Room) SelectGame(name, key, gameID string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以选择游戏")
	}
	if r.phase != PhaseGameSelect {
		return Snapshot{}, actionError("GAME_SELECTION_CLOSED", "当前不是选择游戏阶段")
	}
	option, ok := gameOption(gameID)
	if !ok {
		return Snapshot{}, actionError("UNKNOWN_GAME", "暂不支持这款游戏")
	}
	if len(r.participants) < option.MinPlayers {
		return Snapshot{}, actionError("NOT_ENOUGH_PLAYERS", fmt.Sprintf("%s 至少需要 %d 名玩家", option.Name, option.MinPlayers))
	}
	if len(r.participants) > option.MaxPlayers {
		return Snapshot{}, actionError("TOO_MANY_PLAYERS", fmt.Sprintf("%s 最多支持 %d 名玩家", option.Name, option.MaxPlayers))
	}
	for playerID := range r.participants {
		member := r.players[playerID]
		if member == nil || !member.connected {
			return Snapshot{}, actionError("PLAYER_OFFLINE", "有玩家已经离线，请等待其重连后再选择游戏")
		}
	}

	switch option.ID {
	case GameWhoDrinks:
		game, err := newWhoDrinksGame(r.config, 1)
		if err != nil {
			return Snapshot{}, fmt.Errorf("创建谁喝酒牌组: %w", err)
		}
		r.whoDrinks = game
		r.wanxiang = nil
	case GameWanxiangMahjong:
		game, err := newWanxiangGame(participantNamesLocked(r))
		if err != nil {
			return Snapshot{}, fmt.Errorf("创建万象麻将牌组: %w", err)
		}
		r.wanxiang = game
		r.whoDrinks = nil
	default:
		return Snapshot{}, actionError("UNKNOWN_GAME", "暂不支持这款游戏")
	}
	r.selectedGame = &GameSelection{ID: option.ID, Name: option.Name}
	r.phase = PhaseStarted
	r.revision++
	r.broadcastLocked("game_started", fmt.Sprintf("队长选择了%s，游戏开始", option.Name))
	return r.snapshotLocked(), nil
}

func participantNamesLocked(r *Room) []string {
	names := make([]string, 0, len(r.participants))
	for _, name := range r.order {
		if _, ok := r.participants[name]; ok {
			names = append(names, name)
		}
	}
	return names
}

func (r *Room) ApplyGameAction(name, key string, action GameAction) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if r.selectedGame == nil {
		return Snapshot{}, actionError("GAME_NOT_READY", "游戏还没有准备好")
	}
	if r.selectedGame.ID == GameWanxiangMahjong {
		return r.applyWanxiangActionLocked(p, action)
	}
	if r.selectedGame.ID != GameWhoDrinks || r.whoDrinks == nil {
		return Snapshot{}, actionError("GAME_NOT_READY", "游戏还没有准备好")
	}

	switch action.Type {
	case "flip":
		if r.phase != PhaseStarted {
			return Snapshot{}, actionError("GAME_NOT_ACTIVE", "当前游戏不能翻牌")
		}
		return r.flipCardLocked(p, action.Index)
	case "continue":
		if r.phase != PhaseStarted {
			return Snapshot{}, actionError("GAME_NOT_ACTIVE", "当前游戏不能继续")
		}
		if !r.whoDrinks.locked {
			return Snapshot{}, actionError("GAME_NOT_LOCKED", "当前没有待处理的酒杯结果")
		}
		r.whoDrinks.locked = false
		r.recordGameActionLocked("continue", -1, "", p)
		r.revision++
		r.broadcastLocked("game_updated", fmt.Sprintf("%s 选择继续游戏", p.name))
		return r.snapshotLocked(), nil
	case "next-round":
		if r.phase != PhaseStarted && r.phase != PhaseFinished {
			return Snapshot{}, actionError("GAME_NOT_FINISHED", "当前还不能开始下一轮")
		}
		if r.phase == PhaseStarted && !r.whoDrinks.locked {
			return Snapshot{}, actionError("NEXT_ROUND_NOT_READY", "请先翻出酒杯或完成当前结果")
		}
		game, gameErr := newWhoDrinksGame(r.config, r.whoDrinks.round+1)
		if gameErr != nil {
			return Snapshot{}, fmt.Errorf("创建下一轮牌组: %w", gameErr)
		}
		r.whoDrinks = game
		r.phase = PhaseStarted
		r.recordGameActionLocked("next-round", -1, "", p)
		r.revision++
		r.broadcastLocked("new_round", fmt.Sprintf("%s 开始了第 %d 轮", p.name, game.round))
		return r.snapshotLocked(), nil
	default:
		return Snapshot{}, actionError("UNKNOWN_GAME_ACTION", "无法识别的游戏操作")
	}
}

func (r *Room) Reopen(name, key string) (Snapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return Snapshot{}, err
	}
	if !p.captain {
		return Snapshot{}, actionError("NOT_CAPTAIN", "只有队长可以重新开启房间")
	}
	if r.phase != PhaseStarted && r.phase != PhaseFinished {
		return Snapshot{}, actionError("ROOM_NOT_FINISHED", "当前房间还不能重新开启")
	}

	r.phase = PhaseWaiting
	r.selectedGame = nil
	r.whoDrinks = nil
	r.clearWanxiangLocked()
	r.participants = make(map[string]struct{})
	for _, member := range r.players {
		member.confirmed = false
	}
	r.revision++
	r.broadcastLocked("room_reopened", fmt.Sprintf("队长 %s 将房间重新开启", p.name))
	return r.snapshotLocked(), nil
}

// Subscribe attaches an SSE stream for a named player and always sends the current snapshot first.
func (r *Room) Subscribe(name, key string) (<-chan Event, func(), error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return nil, nil, err
	}

	ch := make(chan Event, 16)
	r.subscribers[ch] = struct{}{}

	wasDisconnected := p.connections == 0
	p.connections++
	p.connected = true
	if wasDisconnected {
		r.revision++
	}
	r.offerLocked(ch, Event{Type: "state", State: r.snapshotLocked()})
	if wasDisconnected {
		r.broadcastLocked("player_connected", fmt.Sprintf("%s 已上线", p.name))
	}

	var once sync.Once
	playerName := p.name
	cancel := func() {
		once.Do(func() {
			r.unsubscribe(playerName, ch)
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
		if _, participant := r.participants[p.name]; participant {
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

func (r *Room) expireConfirmation(generation uint64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.phase != PhaseConfirming || generation != r.confirmationGeneration {
		return
	}
	r.cancelConfirmationLocked()
	r.revision++
	r.broadcastLocked("confirmation_timeout", "开局确认已超时，请队长重新发起")
}

func (r *Room) flipCardLocked(p *player, index int) (Snapshot, error) {
	game := r.whoDrinks
	if game.locked {
		return Snapshot{}, actionError("GAME_LOCKED", "请先处理上一张酒杯牌")
	}
	if index < 0 || index >= len(game.deck) {
		return Snapshot{}, actionError("INVALID_CARD", "卡牌编号无效")
	}
	if _, revealed := game.revealed[index]; revealed {
		return Snapshot{}, actionError("CARD_ALREADY_REVEALED", "这张牌已经翻开")
	}

	kind := game.deck[index]
	game.revealed[index] = RevealedCard{
		Index:     index,
		Kind:      kind,
		ActorID:   p.name,
		ActorName: p.name,
	}
	if kind == "drink" {
		game.remainingDrinks--
		game.locked = true
	}
	r.recordGameActionLocked("flip", index, kind, p)
	r.revision++

	if game.remainingDrinks == 0 {
		game.locked = false
		r.phase = PhaseFinished
		r.broadcastLocked("game_finished", fmt.Sprintf("%s 翻出了最后一杯酒，本轮结束", p.name))
	} else if kind == "drink" {
		r.broadcastLocked("drink_revealed", fmt.Sprintf("%s 翻出了酒杯牌", p.name))
	} else {
		r.broadcastLocked("safe_revealed", fmt.Sprintf("%s 翻出了安全牌", p.name))
	}
	return r.snapshotLocked(), nil
}

func (r *Room) recordGameActionLocked(actionType string, index int, kind string, p *player) {
	r.whoDrinks.nextActionID++
	r.whoDrinks.lastAction = &GameActionView{
		ID:        r.whoDrinks.nextActionID,
		Type:      actionType,
		Index:     index,
		Kind:      kind,
		ActorID:   p.name,
		ActorName: p.name,
	}
}

func (r *Room) playerByNameLocked(name, key string) (*player, error) {
	cleanName, err := normalizeName(name)
	if err != nil {
		return nil, actionError("UNAUTHORIZED", "请先输入玩家名字")
	}
	p, ok := r.players[cleanName]
	if !ok || key == "" || key != p.key {
		return nil, actionError("UNAUTHORIZED", "玩家身份无效，请重新加入房间")
	}
	return p, nil
}

func (r *Room) removePlayerLocked(playerName string) {
	p, ok := r.players[playerName]
	if !ok {
		return
	}
	delete(r.players, playerName)
	delete(r.participants, playerName)

	for i, id := range r.order {
		if id == playerName {
			r.order = append(r.order[:i], r.order[i+1:]...)
			break
		}
	}

	if p.captain && len(r.order) > 0 {
		r.players[r.order[0]].captain = true
	}
	r.dropWanxiangSeatLocked(playerName)
	if len(r.order) == 0 {
		r.phase = PhaseWaiting
		r.selectedGame = nil
		r.whoDrinks = nil
		r.clearWanxiangLocked()
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
	r.stopConfirmationTimerLocked()
	r.phase = PhaseWaiting
	r.participants = make(map[string]struct{})
	for _, p := range r.players {
		p.confirmed = false
	}
}

func (r *Room) stopConfirmationTimerLocked() {
	if r.confirmationTimer != nil {
		r.confirmationTimer.Stop()
		r.confirmationTimer = nil
	}
	r.confirmationGeneration++
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
			ID:        p.name,
			Name:      p.name,
			Captain:   p.captain,
			Connected: p.connected,
			Confirmed: p.confirmed,
		})
	}

	var selectedGame *GameSelection
	if r.selectedGame != nil {
		copy := *r.selectedGame
		selectedGame = &copy
	}

	var gameState *WhoDrinksState
	if r.whoDrinks != nil {
		gameState = r.whoDrinks.view()
	}
	var wanxiang *WanxiangState
	if r.wanxiang != nil {
		wanxiang = r.wanxiang.view()
	}

	gameURL := ""
	if selectedGame != nil {
		gameURL = r.gameURLLocked(selectedGame.ID)
	}

	return Snapshot{
		Code:           r.code,
		Phase:          r.phase,
		Revision:       r.revision,
		Players:        players,
		Confirmation:   ConfirmationView{Accepted: accepted, Total: len(r.participants)},
		Config:         r.config,
		AvailableGames: availableGames(),
		SelectedGame:   selectedGame,
		GameURL:        gameURL,
		GameState:      gameState,
		Wanxiang:       wanxiang,
	}
}

func (g *whoDrinksGame) view() *WhoDrinksState {
	revealed := make([]RevealedCard, 0, len(g.revealed))
	for index := range g.deck {
		if card, ok := g.revealed[index]; ok {
			revealed = append(revealed, card)
		}
	}

	var lastAction *GameActionView
	if g.lastAction != nil {
		copy := *g.lastAction
		lastAction = &copy
	}

	return &WhoDrinksState{
		Round:           g.round,
		Total:           g.config.Total,
		Drinks:          g.config.Drinks,
		RemainingDrinks: g.remainingDrinks,
		Revealed:        revealed,
		Locked:          g.locked,
		LastAction:      lastAction,
	}
}

func (r *Room) gameURLLocked(gameID string) string {
	template := strings.ReplaceAll(r.gameURLTemplate, "{game}", gameID)
	template = strings.ReplaceAll(template, "{room}", r.code)
	parsed, err := url.Parse(template)
	if err != nil {
		return template
	}
	query := parsed.Query()
	query.Set("room", r.code)
	if r.serverURL != "" {
		query.Set("server", r.serverURL)
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func availableGames() []GameOption {
	return []GameOption{
		{
			ID:          GameWhoDrinks,
			Name:        "谁喝酒",
			Description: "多人同步翻牌，翻到酒杯的人喝一杯",
			MinPlayers:  2,
			MaxPlayers:  MaxRoomPlayers,
		},
		{
			ID:          GameWanxiangMahjong,
			Name:        "万象麻将",
			Description: "技能牌对局，胡牌或结束本轮需全员表决",
			MinPlayers:  2,
			MaxPlayers:  4,
		},
	}
}

func gameOption(gameID string) (GameOption, bool) {
	for _, option := range availableGames() {
		if option.ID == gameID {
			return option, true
		}
	}
	return GameOption{}, false
}

func validateWhoDrinksConfig(config WhoDrinksConfig) (WhoDrinksConfig, error) {
	if config.Total < 2 || config.Total > 36 {
		return WhoDrinksConfig{}, actionError("INVALID_GAME_CONFIG", "卡牌数量必须在 2 到 36 之间")
	}
	if config.Drinks < 1 || config.Drinks >= config.Total {
		return WhoDrinksConfig{}, actionError("INVALID_GAME_CONFIG", "酒杯数量必须大于 0 且少于卡牌数量")
	}
	return config, nil
}

func newWhoDrinksGame(config WhoDrinksConfig, round int) (*whoDrinksGame, error) {
	config, err := validateWhoDrinksConfig(config)
	if err != nil {
		return nil, err
	}
	deck := make([]string, 0, config.Total)
	for i := 0; i < config.Drinks; i++ {
		deck = append(deck, "drink")
	}
	for i := config.Drinks; i < config.Total; i++ {
		deck = append(deck, "safe")
	}
	for i := len(deck) - 1; i > 0; i-- {
		number, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return nil, err
		}
		j := int(number.Int64())
		deck[i], deck[j] = deck[j], deck[i]
	}
	return &whoDrinksGame{
		round:           round,
		config:          config,
		deck:            deck,
		revealed:        make(map[int]RevealedCard),
		remainingDrinks: config.Drinks,
	}, nil
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
	default:
		select {
		case <-ch:
		default:
		}
		select {
		case ch <- event:
		default:
		}
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

func randomKey() (string, error) {
	buffer := make([]byte, 24)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func actionError(code, message string) *ActionError {
	return &ActionError{Code: code, Message: message}
}
