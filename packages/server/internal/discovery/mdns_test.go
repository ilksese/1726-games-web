package discovery

import "testing"

func TestNormalizeHostname(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "1726-games", want: "1726-games"},
		{input: "1726-games.local", want: "1726-games"},
		{input: "1726-GAMES.", want: "1726-games"},
	}
	for _, test := range tests {
		got, err := normalizeHostname(test.input)
		if err != nil {
			t.Fatalf("normalizeHostname(%q): %v", test.input, err)
		}
		if got != test.want {
			t.Fatalf("normalizeHostname(%q) = %q, want %q", test.input, got, test.want)
		}
	}

	for _, input := range []string{"", ".local", "-1726", "1726-", "room/name"} {
		if _, err := normalizeHostname(input); err == nil {
			t.Fatalf("normalizeHostname(%q) unexpectedly succeeded", input)
		}
	}
}

func TestAdvertisementURL(t *testing.T) {
	advertisement := &Advertisement{hostname: "1726-games", port: 5174}
	if got := advertisement.Hostname(); got != "1726-games.local" {
		t.Fatalf("Hostname() = %q", got)
	}
	if got := advertisement.URL("123456"); got != "http://1726-games.local:5174/room/123456" {
		t.Fatalf("URL() = %q", got)
	}
}
