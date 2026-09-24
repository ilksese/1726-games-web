package room

import (
	"strings"
	"testing"
	"time"
)

func testRoom(options ...Options) *Room {
	if len(options) == 0 {
		options = append(options, Options{
			GameURLTemplate:     "http://127.0.0.1:5173/{game}",
			ServerURL:           "http://127.0.0.1:5174",
			DisconnectGrace:     time.Second,
			ConfirmationTimeout: time.Second,
		})
	}
	return New("123456", options[0])
}

func connectPlayer(t *testing.T, r *Room, name, key string) func() {
	t.Helper()
	_, cancel, err := r.Subscribe(name, key)
	if err != nil {
		t.Fatal(err)
	}
	return cancel
}

func joinTwo(t *testing.T, r *Room) (Session, Session, func(), func()) {
	t.Helper()
	captain, _, err := r.Join("队长", "")
	if err != nil {
		t.Fatal(err)
	}
	member, _, err := r.Join("队员", "")
	if err != nil {
		t.Fatal(err)
	}
	cancelCaptain := connectPlayer(t, r, captain.Name, captain.Key)
	cancelMember := connectPlayer(t, r, member.Name, member.Key)
	return captain, member, cancelCaptain, cancelMember
}

func TestFirstPlayerBecomesCaptain(t *testing.T) {
	r := testRoom()
	first, state, err := r.Join("甲", "")
	if err != nil {
		t.Fatal(err)
	}
	second, state, err := r.Join("乙", "")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.Join("甲", ""); errorCode(err) != "NAME_TAKEN" {
		t.Fatalf("duplicate name error = %v, want NAME_TAKEN", err)
	}
	resumed, _, err := r.Join("甲", first.Key)
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Key != first.Key {
		t.Fatalf("resume key = %q, want %q", resumed.Key, first.Key)
	}

	if first.Name == second.Name {
		t.Fatal("players should have different names")
	}
	if len(state.Players) != 2 {
		t.Fatalf("got %d players, want 2", len(state.Players))
	}
	if !state.Players[0].Captain || state.Players[1].Captain {
		t.Fatalf("captain assignment is wrong: %+v", state.Players)
	}
}

func TestCaptainCanConfigureAndOnlyCaptainCanChangeConfig(t *testing.T) {
	r := testRoom()
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelCaptain()
	defer cancelMember()

	if _, err := r.SetConfig(member.Name, member.Key, WhoDrinksConfig{Total: 20, Drinks: 4}); errorCode(err) != "NOT_CAPTAIN" {
		t.Fatalf("member config error = %v, want NOT_CAPTAIN", err)
	}
	state, err := r.SetConfig(captain.Name, captain.Key, WhoDrinksConfig{Total: 20, Drinks: 4})
	if err != nil {
		t.Fatal(err)
	}
	if state.Config != (WhoDrinksConfig{Total: 20, Drinks: 4}) {
		t.Fatalf("config = %+v", state.Config)
	}
	if _, err := r.SetConfig(captain.Name, captain.Key, WhoDrinksConfig{Total: 1, Drinks: 1}); errorCode(err) != "INVALID_GAME_CONFIG" {
		t.Fatalf("invalid config error = %v, want INVALID_GAME_CONFIG", err)
	}
}

func TestAllConfirmationLeadsToCaptainGameSelection(t *testing.T) {
	r := testRoom()
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelCaptain()
	defer cancelMember()

	if _, err := r.RequestStart(member.Name, member.Key); errorCode(err) != "NOT_CAPTAIN" {
		t.Fatalf("member start error = %v, want NOT_CAPTAIN", err)
	}

	state, err := r.RequestStart(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseConfirming || state.Confirmation.Total != 2 {
		t.Fatalf("unexpected confirmation state: %+v", state)
	}

	state, err = r.Confirm(captain.Name, captain.Key, true)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseConfirming || state.Confirmation.Accepted != 1 {
		t.Fatalf("game selection opened too early: %+v", state)
	}

	state, err = r.Confirm(member.Name, member.Key, true)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseGameSelect || state.Confirmation.Accepted != 2 {
		t.Fatalf("unexpected game selection state: %+v", state)
	}
	if _, err := r.SelectGame(member.Name, member.Key, GameWhoDrinks); errorCode(err) != "NOT_CAPTAIN" {
		t.Fatalf("member select error = %v, want NOT_CAPTAIN", err)
	}

	state, err = r.SelectGame(captain.Name, captain.Key, GameWhoDrinks)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseStarted || state.SelectedGame == nil || state.SelectedGame.ID != GameWhoDrinks {
		t.Fatalf("unexpected started state: %+v", state)
	}
	if !strings.Contains(state.GameURL, "room=123456") || !strings.Contains(state.GameURL, "server=http%3A%2F%2F127.0.0.1%3A5174") {
		t.Fatalf("game URL does not carry room context: %s", state.GameURL)
	}
	if state.GameState == nil || state.GameState.Round != 1 {
		t.Fatalf("game state not initialized: %+v", state.GameState)
	}
}

func startWhoDrinks(t *testing.T, r *Room) (Session, Session, func(), func()) {
	t.Helper()
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	if _, err := r.RequestStart(captain.Name, captain.Key); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Confirm(captain.Name, captain.Key, true); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Confirm(member.Name, member.Key, true); err != nil {
		t.Fatal(err)
	}
	if _, err := r.SelectGame(captain.Name, captain.Key, GameWhoDrinks); err != nil {
		t.Fatal(err)
	}
	return captain, member, cancelCaptain, cancelMember
}

func TestCaptainCanCancelGameSelection(t *testing.T) {
	r := testRoom()
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelCaptain()
	defer cancelMember()

	if _, err := r.RequestStart(captain.Name, captain.Key); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Confirm(captain.Name, captain.Key, true); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Confirm(member.Name, member.Key, true); err != nil {
		t.Fatal(err)
	}
	if _, err := r.CancelStart(member.Name, member.Key); errorCode(err) != "NOT_CAPTAIN" {
		t.Fatalf("member cancel error = %v, want NOT_CAPTAIN", err)
	}
	state, err := r.CancelStart(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseWaiting || state.Confirmation.Total != 0 {
		t.Fatalf("cancel should restore waiting state: %+v", state)
	}
}

func TestWhoDrinksActionsAreServerAuthoritative(t *testing.T) {
	r := testRoom()
	captain, member, cancelCaptain, cancelMember := startWhoDrinks(t, r)
	defer cancelCaptain()
	defer cancelMember()

	state := r.State()
	for index := 0; index < state.GameState.Total; index++ {
		var err error
		state, err = r.ApplyGameAction(member.Name, member.Key, GameAction{Type: "flip", Index: index})
		if err != nil {
			t.Fatalf("flip %d: %v", index, err)
		}
		last := state.GameState.LastAction
		if last == nil || last.Type != "flip" || last.Index != index {
			t.Fatalf("missing flip action: %+v", state.GameState)
		}
		if last.Kind == "drink" {
			if state.Phase == PhaseFinished {
				break
			}
			if !state.GameState.Locked {
				t.Fatalf("drink card should lock game: %+v", state.GameState)
			}
			state, err = r.ApplyGameAction(captain.Name, captain.Key, GameAction{Type: "continue", Index: -1})
			if err != nil {
				t.Fatalf("continue after drink: %v", err)
			}
			if state.GameState.Locked {
				t.Fatalf("continue did not unlock game: %+v", state.GameState)
			}
		}
	}

	if state.Phase != PhaseFinished || state.GameState.RemainingDrinks != 0 {
		t.Fatalf("game did not finish after revealing deck: %+v", state)
	}
	state, err := r.ApplyGameAction(captain.Name, captain.Key, GameAction{Type: "next-round", Index: -1})
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseStarted || state.GameState.Round != 2 || len(state.GameState.Revealed) != 0 {
		t.Fatalf("next round did not reset game: %+v", state)
	}
}

func TestDeclineAndTimeoutCancelConfirmation(t *testing.T) {
	r := testRoom(Options{
		GameURLTemplate:     "http://127.0.0.1:5173/{game}",
		ServerURL:           "http://127.0.0.1:5174",
		DisconnectGrace:     time.Second,
		ConfirmationTimeout: 20 * time.Millisecond,
	})
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelCaptain()
	defer cancelMember()

	if _, err := r.RequestStart(captain.Name, captain.Key); err != nil {
		t.Fatal(err)
	}
	state, err := r.Confirm(member.Name, member.Key, false)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseWaiting || state.Confirmation.Total != 0 {
		t.Fatalf("decline should restore waiting state: %+v", state)
	}

	if _, err := r.RequestStart(captain.Name, captain.Key); err != nil {
		t.Fatal(err)
	}
	time.Sleep(50 * time.Millisecond)
	if state := r.State(); state.Phase != PhaseWaiting {
		t.Fatalf("timeout should restore waiting state: %+v", state)
	}
}

func TestCaptainIsPromotedAfterLeaving(t *testing.T) {
	r := testRoom()
	captain, _, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelMember()
	cancelCaptain()

	state, err := r.Leave(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Players) != 1 || !state.Players[0].Captain || state.Players[0].Name != "队员" {
		t.Fatalf("captain was not promoted: %+v", state.Players)
	}
}

func TestDisconnectCancelsConfirmationAndEventuallyRemovesPlayer(t *testing.T) {
	r := testRoom(Options{
		GameURLTemplate:     "http://127.0.0.1:5173/{game}",
		ServerURL:           "http://127.0.0.1:5174",
		DisconnectGrace:     10 * time.Millisecond,
		ConfirmationTimeout: time.Second,
	})
	captain, member, cancelCaptain, cancelMember := joinTwo(t, r)
	defer cancelCaptain()

	if _, err := r.RequestStart(captain.Name, captain.Key); err != nil {
		t.Fatal(err)
	}
	cancelMember()

	if state := r.State(); state.Phase != PhaseWaiting {
		t.Fatalf("disconnect should cancel confirmation: %+v", state)
	}

	time.Sleep(30 * time.Millisecond)
	state := r.State()
	if len(state.Players) != 1 || state.Players[0].Name != "队长" {
		t.Fatalf("disconnected player was not removed: %+v", state.Players)
	}
	_ = member
}

func TestCaptainCanReopenFinishedRoom(t *testing.T) {
	r := testRoom()
	captain, member, cancelCaptain, cancelMember := startWhoDrinks(t, r)
	defer cancelCaptain()
	defer cancelMember()

	state, err := r.Reopen(member.Name, member.Key)
	if errorCode(err) != "NOT_CAPTAIN" || state.Phase != "" {
		t.Fatalf("member reopen error = %v, state = %+v", err, state)
	}
	state, err = r.Reopen(captain.Name, captain.Key)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseWaiting || state.SelectedGame != nil || state.GameState != nil {
		t.Fatalf("room was not reopened: %+v", state)
	}
}

func errorCode(err error) string {
	if actionErr, ok := err.(*ActionError); ok {
		return actionErr.Code
	}
	return ""
}
