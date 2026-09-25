package room

import (
	"crypto/rand"
	"math/big"
	"time"
)

var wanxiangSkills = []string{
	"no-pung",
	"no-kong",
	"no-chow",
	"no-win",
	"no-dots",
	"no-bams",
	"no-chars",
	"no-honors",
	"no-draw",
	"no-ready",
	"no-meld-in",
	"no-remeld",
}

func newWanxiangGame(names []string) (*wanxiangGame, error) {
	pool := make([]string, 0, len(wanxiangSkills)*5)
	for _, skill := range wanxiangSkills {
		for copy := 0; copy < 5; copy++ {
			pool = append(pool, skill)
		}
	}
	if err := shuffleStrings(pool); err != nil {
		return nil, err
	}

	game := &wanxiangGame{
		round: 0,
		order: append([]string(nil), names...),
		seats: make(map[string]*wanxiangSeat, len(names)),
	}
	for _, name := range names {
		hand := append([]string(nil), pool[:wanxiangHandSize]...)
		pool = pool[wanxiangHandSize:]
		game.seats[name] = &wanxiangSeat{name: name, hand: hand}
	}
	game.pool = pool
	return game, nil
}

func (r *Room) OwnHand(name, key string) (WanxiangHand, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, err := r.playerByNameLocked(name, key)
	if err != nil {
		return WanxiangHand{}, err
	}
	if r.wanxiang == nil || r.selectedGame == nil || r.selectedGame.ID != GameWanxiangMahjong {
		return WanxiangHand{}, actionError("GAME_NOT_READY", "万象麻将还没有开始")
	}
	seat := r.wanxiang.seats[p.name]
	if seat == nil {
		return WanxiangHand{}, actionError("NOT_PARTICIPANT", "你不在本局牌局中")
	}
	return WanxiangHand{Cards: append([]string(nil), seat.hand...)}, nil
}

func (r *Room) applyWanxiangActionLocked(p *player, action GameAction) (Snapshot, error) {
	game := r.wanxiang
	if game == nil {
		return Snapshot{}, actionError("GAME_NOT_READY", "游戏还没有准备好")
	}
	if _, ok := game.seats[p.name]; !ok {
		return Snapshot{}, actionError("NOT_PARTICIPANT", "你不在本局牌局中")
	}

	switch action.Type {
	case "win":
		return r.openWanxiangVoteLocked(p, "win", action.Nominee)
	case "end-round":
		return r.openWanxiangVoteLocked(p, "end-round", "")
	case "respond":
		return r.respondWanxiangLocked(p, action.Agree)
	case "play":
		return r.playWanxiangCardLocked(p, action.HandIndex)
	default:
		return Snapshot{}, actionError("UNKNOWN_GAME_ACTION", "无法识别的游戏操作")
	}
}

func (r *Room) openWanxiangVoteLocked(p *player, kind, nominee string) (Snapshot, error) {
	game := r.wanxiang
	if r.phase != PhaseStarted || game.vote != nil {
		return Snapshot{}, actionError("VOTE_NOT_ALLOWED", "当前不能发起表决")
	}
	if kind == "win" {
		if game.seats[nominee] == nil {
			return Snapshot{}, actionError("INVALID_NOMINEE", "被提名的玩家不在本局中")
		}
	}
	r.startWanxiangVoteLocked(kind, p.name, nominee)
	r.revision++
	message := fmtVoteOpen(kind, p.name, nominee)
	r.broadcastLocked("game_updated", message)
	return r.snapshotLocked(), nil
}

func (r *Room) startWanxiangVoteLocked(kind, proposer, nominee string) {
	game := r.wanxiang
	game.voteGeneration++
	generation := game.voteGeneration
	vote := &wanxiangVote{
		kind:     kind,
		proposer: proposer,
		nominee:  nominee,
		openedAt: time.Now(),
		agreed:   map[string]struct{}{proposer: {}},
	}
	if kind == "win" {
		vote.timer = time.AfterFunc(wanxiangVoteTimeout, func() {
			r.expireWanxiangVote(generation)
		})
	}
	game.vote = vote
}

func (r *Room) respondWanxiangLocked(p *player, agree *bool) (Snapshot, error) {
	game := r.wanxiang
	vote := game.vote
	if r.phase != PhaseStarted || vote == nil {
		return Snapshot{}, actionError("NO_OPEN_VOTE", "当前没有待表决的请求")
	}
	if p.name == vote.proposer || !r.wanxiangPending(vote, p.name) {
		return Snapshot{}, actionError("NOT_VOTER", "你不能对这次表决投票")
	}
	if _, already := vote.agreed[p.name]; already {
		return Snapshot{}, actionError("ALREADY_VOTED", "你已经同意过这次表决")
	}
	if agree == nil {
		return Snapshot{}, actionError("INVALID_REQUEST", "请明确同意或拒绝")
	}
	if !*agree {
		r.clearWanxiangVoteLocked()
		r.revision++
		r.broadcastLocked("game_updated", p.name+" 拒绝了这次表决")
		return r.snapshotLocked(), nil
	}
	vote.agreed[p.name] = struct{}{}
	if r.wanxiangAllAgreedLocked(vote) {
		r.passWanxiangVoteLocked()
		r.revision++
		r.broadcastLocked("game_updated", "表决通过")
		return r.snapshotLocked(), nil
	}
	r.revision++
	r.broadcastLocked("game_updated", p.name+" 同意了这次表决")
	return r.snapshotLocked(), nil
}

func (r *Room) playWanxiangCardLocked(p *player, index int) (Snapshot, error) {
	game := r.wanxiang
	if r.phase != PhaseStarted || game.vote != nil {
		return Snapshot{}, actionError("PLAY_NOT_ALLOWED", "表决进行中不能出牌")
	}
	seat := game.seats[p.name]
	if index < 0 || index >= len(seat.hand) {
		return Snapshot{}, actionError("INVALID_CARD", "手牌编号无效")
	}
	skillID := seat.hand[index]
	seat.hand = append(seat.hand[:index], seat.hand[index+1:]...)
	game.played = append(game.played, WanxiangPlayedCard{SkillID: skillID, Player: p.name})
	r.revision++
	r.broadcastLocked("game_updated", p.name+" 打出了一张技能牌")
	return r.snapshotLocked(), nil
}

func (r *Room) expireWanxiangVote(generation uint64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	game := r.wanxiang
	if game == nil || game.vote == nil || game.voteGeneration != generation || r.phase != PhaseStarted {
		return
	}
	r.passWanxiangVoteLocked()
	r.revision++
	r.broadcastLocked("game_updated", "表决时间到，视为通过")
}

func (r *Room) passWanxiangVoteLocked() {
	game := r.wanxiang
	vote := game.vote
	if vote == nil {
		return
	}
	if vote.kind == "win" {
		if seat := game.seats[vote.nominee]; seat != nil {
			seat.score++
		}
	}
	game.round++
	r.clearWanxiangVoteLocked()
	// Five rounds ends the match. Captain Reopen returns the room to waiting;
	// there is no in-game rematch, so who-drinks keeps the same phase model.
	if game.round >= wanxiangRounds {
		r.phase = PhaseFinished
		for _, seat := range game.seats {
			seat.hand = nil
		}
		game.played = nil
		return
	}
	for _, name := range game.order {
		seat := game.seats[name]
		for len(seat.hand) < wanxiangHandSize && len(game.pool) > 0 {
			seat.hand = append(seat.hand, game.pool[0])
			game.pool = game.pool[1:]
		}
	}
}

func (r *Room) wanxiangPending(vote *wanxiangVote, name string) bool {
	if name == vote.proposer {
		return false
	}
	if _, inMatch := r.wanxiang.seats[name]; !inMatch {
		return false
	}
	_, agreed := vote.agreed[name]
	return !agreed
}

func (r *Room) wanxiangAllAgreedLocked(vote *wanxiangVote) bool {
	for name := range r.wanxiang.seats {
		if name == vote.proposer {
			continue
		}
		if _, agreed := vote.agreed[name]; !agreed {
			return false
		}
	}
	return true
}

func (r *Room) clearWanxiangVoteLocked() {
	if r.wanxiang == nil || r.wanxiang.vote == nil {
		return
	}
	if r.wanxiang.vote.timer != nil {
		r.wanxiang.vote.timer.Stop()
	}
	// Bump before clearing so a late timer cannot pass a cancelled vote.
	r.wanxiang.voteGeneration++
	r.wanxiang.vote = nil
}

func (r *Room) clearWanxiangLocked() {
	if r.wanxiang != nil {
		r.clearWanxiangVoteLocked()
	}
	r.wanxiang = nil
}

func (g *wanxiangGame) view() *WanxiangState {
	seats := make([]WanxiangSeatView, 0, len(g.order))
	for _, name := range g.order {
		seat := g.seats[name]
		seats = append(seats, WanxiangSeatView{
			Name:      seat.name,
			Score:     seat.score,
			HandCount: len(seat.hand),
		})
	}
	played := append([]WanxiangPlayedCard(nil), g.played...)
	if played == nil {
		played = []WanxiangPlayedCard{}
	}
	state := &WanxiangState{
		Round:  g.round,
		Pool:   len(g.pool),
		Seats:  seats,
		Played: played,
	}
	if g.vote != nil {
		agreed := make([]string, 0, len(g.vote.agreed))
		pending := make([]string, 0)
		for _, name := range g.order {
			if _, ok := g.vote.agreed[name]; ok {
				agreed = append(agreed, name)
				continue
			}
			pending = append(pending, name)
		}
		state.Vote = &WanxiangVoteView{
			Kind:      g.vote.kind,
			Proposer:  g.vote.proposer,
			Nominee:   g.vote.nominee,
			OpenedAt:  g.vote.openedAt.UnixMilli(),
			ExpiresAt: g.vote.openedAt.Add(wanxiangVoteTimeout).UnixMilli(),
			Agreed:    agreed,
			Pending:   pending,
		}
	}
	return state
}

func fmtVoteOpen(kind, proposer, nominee string) string {
	if kind == "win" {
		return proposer + " 提名 " + nominee + " 胡牌"
	}
	return proposer + " 提议结束本轮"
}

func shuffleStrings(values []string) error {
	for i := len(values) - 1; i > 0; i-- {
		number, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(number.Int64())
		values[i], values[j] = values[j], values[i]
	}
	return nil
}
