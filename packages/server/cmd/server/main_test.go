package main

import (
	"net"
	"strconv"
	"testing"
)

func TestBuildInviteURL(t *testing.T) {
	tests := []struct {
		name      string
		publicURL string
		host      string
		port      string
		code      string
		want      string
	}{
		{
			name: "discovered host",
			host: "192.168.1.20",
			port: "5174",
			code: "123456",
			want: "http://192.168.1.20:5174/room/123456",
		},
		{
			name:      "configured base URL",
			publicURL: "https://games.example.test/lan",
			code:      "654321",
			want:      "https://games.example.test/lan/room/654321",
		},
		{
			name:      "code placeholder",
			publicURL: "https://games.example.test/invite/{code}",
			code:      "654321",
			want:      "https://games.example.test/invite/654321",
		},
		{
			name:      "port placeholder with generated room path",
			publicURL: "games.example.test:{port}",
			port:      "5180",
			code:      "654321",
			want:      "http://games.example.test:5180/room/654321",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := buildInviteURL(test.publicURL, test.host, test.port, test.code)
			if err != nil {
				t.Fatal(err)
			}
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
		})
	}
}

func TestValidateRoomCode(t *testing.T) {
	if err := validateRoomCode("123456"); err != nil {
		t.Fatalf("valid room code failed: %v", err)
	}
	for _, invalid := range []string{"12345", "1234567", "12A456"} {
		if err := validateRoomCode(invalid); err == nil {
			t.Fatalf("invalid room code %q passed", invalid)
		}
	}
}

func TestListenOnAvailablePortIncrementsWhenOccupied(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()

	_, portText, err := net.SplitHostPort(occupied.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	startPort, err := strconv.Atoi(portText)
	if err != nil {
		t.Fatal(err)
	}
	if startPort >= 65535 {
		t.Skip("系统分配了最后一个端口，无法验证递增")
	}

	listener, actualPort, err := listenOnAvailablePort("127.0.0.1", startPort)
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	if actualPort <= startPort {
		t.Fatalf("actual port = %d, want a port greater than occupied port %d", actualPort, startPort)
	}
}
