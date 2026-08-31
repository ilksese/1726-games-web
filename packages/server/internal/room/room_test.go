package room

import (
	"testing"
	"time"
)

func TestFirstPlayerBecomesCaptain(t *testing.T) {
	r := New("123456", "", time.Second)

	first, state, err := r.Join("甲", "")
	if err != nil {
		t.Fatal(err)
	}
	second, state, err := r.Join("乙", "")
	if err != nil {
		t.Fatal(err)
	}

	if first.PlayerID == second.PlayerID {
		t.Fatal("players should have different ids")
	}
	if len(state.Players) != 2 {
		t.Fatalf("got %d players, want 2", len(state.Players))
	}
	if !state.Players[0].Captain || state.Players[1].Captain {
		t.Fatalf("captain assignment is wrong: %+v", state.Players)
	}
}

func TestOnlyCaptainCanRequestStartAndAllMustConfirm(t *testing.T) {
	r := New("123456", "/number-detective", time.Second)
	captain, _, err := r.Join("队长", "")
	if err != nil {
		t.Fatal(err)
	}
	member, _, err := r.Join("队员", "")
	if err != nil {
		t.Fatal(err)
	}

	_, cancelCaptain, err := r.Subscribe(captain.Token)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelCaptain()
	_, cancelMember, err := r.Subscribe(member.Token)
	if err != nil {
		t.Fatal(err)
	}
	defer cancelMember()

	if _, err := r.RequestStart(member.Token); errorCode(err) != "NOT_CAPTAIN" {
		t.Fatalf("member start error = %v, want NOT_CAPTAIN", err)
	}

	state, err := r.RequestStart(captain.Token)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseConfirming || state.Confirmation.Total != 2 {
		t.Fatalf("unexpected confirmation state: %+v", state)
	}

	state, err = r.Confirm(captain.Token, true)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseConfirming || state.Confirmation.Accepted != 1 {
		t.Fatalf("game started before everyone agreed: %+v", state)
	}

	state, err = r.Confirm(member.Token, true)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseStarted || state.Confirmation.Accepted != 2 {
		t.Fatalf("game did not start after unanimous agreement: %+v", state)
	}
}

func TestDeclineCancelsConfirmation(t *testing.T) {
	r := New("123456", "", time.Second)
	captain, _, _ := r.Join("队长", "")
	member, _, _ := r.Join("队员", "")
	_, cancelCaptain, _ := r.Subscribe(captain.Token)
	defer cancelCaptain()
	_, cancelMember, _ := r.Subscribe(member.Token)
	defer cancelMember()

	if _, err := r.RequestStart(captain.Token); err != nil {
		t.Fatal(err)
	}
	state, err := r.Confirm(member.Token, false)
	if err != nil {
		t.Fatal(err)
	}
	if state.Phase != PhaseWaiting || state.Confirmation.Total != 0 {
		t.Fatalf("decline should restore waiting state: %+v", state)
	}
}

func TestCaptainIsPromotedAfterLeaving(t *testing.T) {
	r := New("123456", "", time.Second)
	captain, _, _ := r.Join("甲", "")
	_, _, _ = r.Join("乙", "")

	state, err := r.Leave(captain.Token)
	if err != nil {
		t.Fatal(err)
	}
	if len(state.Players) != 1 || !state.Players[0].Captain || state.Players[0].Name != "乙" {
		t.Fatalf("captain was not promoted: %+v", state.Players)
	}
}

func TestDisconnectCancelsConfirmationAndEventuallyRemovesPlayer(t *testing.T) {
	r := New("123456", "", 10*time.Millisecond)
	captain, _, _ := r.Join("甲", "")
	member, _, _ := r.Join("乙", "")
	_, cancelCaptain, _ := r.Subscribe(captain.Token)
	defer cancelCaptain()
	_, cancelMember, _ := r.Subscribe(member.Token)

	if _, err := r.RequestStart(captain.Token); err != nil {
		t.Fatal(err)
	}
	cancelMember()

	if state := r.State(); state.Phase != PhaseWaiting {
		t.Fatalf("disconnect should cancel confirmation: %+v", state)
	}

	time.Sleep(30 * time.Millisecond)
	state := r.State()
	if len(state.Players) != 1 || state.Players[0].Name != "甲" {
		t.Fatalf("disconnected player was not removed: %+v", state.Players)
	}
}

func errorCode(err error) string {
	if actionErr, ok := err.(*ActionError); ok {
		return actionErr.Code
	}
	return ""
}
