package main

import (
	"context"
	"crypto/rand"
	"errors"
	"flag"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/ilksese/1726-games-web/packages/server/internal/discovery"
	"github.com/ilksese/1726-games-web/packages/server/internal/room"
	"github.com/ilksese/1726-games-web/packages/server/internal/web"
	qrcode "github.com/skip2/go-qrcode"
)

type config struct {
	bindAddress         string
	port                string
	advertiseHost       string
	publicURL           string
	webURL              string
	gameURL             string
	roomCode            string
	mdnsEnabled         bool
	mdnsHost            string
	disconnectWait      time.Duration
	confirmationTimeout time.Duration
}

func main() {
	if err := run(); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		log.Fatal(err)
	}
}

func run() error {
	cfg, err := loadConfig(os.Args[1:])
	if err != nil {
		return err
	}

	requestedPort, err := strconv.Atoi(cfg.port)
	if err != nil {
		return fmt.Errorf("解析监听端口: %w", err)
	}
	listener, actualPort, err := listenOnAvailablePort(cfg.bindAddress, requestedPort)
	if err != nil {
		return err
	}
	defer listener.Close()

	actualPortText := strconv.Itoa(actualPort)
	logger := log.New(os.Stdout, "[1726-server] ", log.LstdFlags)

	ipInviteURL, err := buildInviteURL("", cfg.advertiseHost, actualPortText, cfg.roomCode)
	if err != nil {
		return err
	}
	configuredInviteURL, err := buildInviteURL(cfg.publicURL, cfg.advertiseHost, actualPortText, cfg.roomCode)
	if err != nil {
		return err
	}

	var mdnsAdvertisement *discovery.Advertisement
	if cfg.mdnsEnabled {
		mdnsAdvertisement, err = discovery.Register(cfg.mdnsHost, cfg.advertiseHost, actualPort, cfg.roomCode)
		if err != nil {
			logger.Printf("mDNS 注册失败，将继续使用局域网 IP：%v", err)
		} else {
			defer mdnsAdvertisement.Close()
			logger.Printf("mDNS 地址：%s", mdnsAdvertisement.URL(cfg.roomCode))
		}
	}

	mdnsURL := ""
	if mdnsAdvertisement != nil {
		mdnsURL = mdnsAdvertisement.URL(cfg.roomCode)
	}
	inviteURL := ipInviteURL
	if cfg.publicURL != "" {
		inviteURL = configuredInviteURL
	}

	webPort := envOr("VITE_1726_GAME_PORT", "5173")
	webURL := cfg.webURL
	if webURL == "" {
		webURL = "http://" + net.JoinHostPort(cfg.advertiseHost, webPort)
	}
	gameURLTemplate := cfg.gameURL
	if gameURLTemplate == "" {
		gameURLTemplate = strings.TrimRight(webURL, "/") + "/{game}"
	}
	serverOrigin, err := urlOrigin(inviteURL)
	if err != nil {
		return fmt.Errorf("解析房间服务地址: %w", err)
	}
	allowedOrigins := make([]string, 0, 3)
	originCandidates := []string{
		gameURLTemplate,
		"http://" + net.JoinHostPort(cfg.advertiseHost, webPort),
		"http://" + net.JoinHostPort("localhost", webPort),
		"http://" + net.JoinHostPort("127.0.0.1", webPort),
	}
	if mdnsAdvertisement != nil {
		originCandidates = append(originCandidates, "http://"+net.JoinHostPort(mdnsAdvertisement.Hostname(), webPort))
	}
	seenOrigins := make(map[string]struct{})
	for _, candidate := range originCandidates {
		origin, originErr := urlOrigin(candidate)
		if originErr != nil {
			continue
		}
		if _, seen := seenOrigins[origin]; seen {
			continue
		}
		seenOrigins[origin] = struct{}{}
		allowedOrigins = append(allowedOrigins, origin)
	}
	gameRoom := room.New(cfg.roomCode, room.Options{
		GameURLTemplate:     gameURLTemplate,
		ServerURL:           serverOrigin,
		DisconnectGrace:     cfg.disconnectWait,
		ConfirmationTimeout: cfg.confirmationTimeout,
	})
	defer gameRoom.Close()
	handler, err := web.New(gameRoom, web.InviteInfo{
		PrimaryURL: inviteURL,
		IPURL:      ipInviteURL,
		MDNSURL:    mdnsURL,
	}, allowedOrigins)
	if err != nil {
		return err
	}

	listenAddress := net.JoinHostPort(cfg.bindAddress, actualPortText)
	server := &http.Server{
		Addr:              listenAddress,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       90 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	logger.Printf("局域网房间已创建，房间号 %s", cfg.roomCode)
	if actualPort != requestedPort {
		logger.Printf("端口 %d 已被占用，自动切换到端口 %d", requestedPort, actualPort)
	}
	logger.Printf("邀请链接：%s", inviteURL)
	logger.Printf("局域网 IP 地址：%s", ipInviteURL)
	logger.Printf("本机入口：http://localhost:%s/room/%s", actualPortText, cfg.roomCode)
	printTerminalQRCode(os.Stdout, inviteURL)

	errorChannel := make(chan error, 1)
	go func() {
		logger.Printf("正在监听 %s", listenAddress)
		errorChannel <- server.Serve(listener)
	}()

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case serveErr := <-errorChannel:
		if errors.Is(serveErr, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("启动局域网服务器: %w", serveErr)
	case <-signalContext.Done():
		logger.Println("正在关闭房间…")
		shutdownContext, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			return fmt.Errorf("关闭服务器: %w", err)
		}
		logger.Println("房间已关闭")
		return nil
	}
}

func loadConfig(arguments []string) (config, error) {
	if len(arguments) > 0 && arguments[0] == "--" {
		arguments = arguments[1:]
	}

	flags := flag.NewFlagSet("1726-games-server", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)

	defaultRoomCode := strings.TrimSpace(os.Getenv("ROOM_CODE"))
	if defaultRoomCode == "" {
		generatedCode, err := generateRoomCode()
		if err != nil {
			return config{}, fmt.Errorf("生成房间号: %w", err)
		}
		defaultRoomCode = generatedCode
	}

	cfg := config{}
	flags.StringVar(&cfg.bindAddress, "bind", envOr("BIND_ADDRESS", "0.0.0.0"), "监听地址")
	flags.StringVar(&cfg.port, "port", envOr("PORT", "5174"), "监听端口")
	flags.StringVar(&cfg.advertiseHost, "advertise-host", strings.TrimSpace(os.Getenv("ADVERTISE_HOST")), "二维码中使用的局域网主机名或 IP")
	flags.StringVar(&cfg.publicURL, "public-url", strings.TrimSpace(os.Getenv("PUBLIC_URL")), "对外访问根地址，可使用 {code}、{port} 占位符")
	flags.StringVar(&cfg.webURL, "web-url", strings.TrimSpace(os.Getenv("WEB_URL")), "游戏前端根地址，默认使用局域网主机的 VITE_1726_GAME_PORT（默认 5173）")
	flags.StringVar(&cfg.gameURL, "game-url", strings.TrimSpace(os.Getenv("GAME_URL")), "全员确认后跳转的游戏地址，可使用 {game}、{room} 占位符")
	flags.StringVar(&cfg.roomCode, "room-code", defaultRoomCode, "固定 6 位房间号")
	flags.BoolVar(&cfg.mdnsEnabled, "mdns", envBool("MDNS_ENABLED", true), "启用 mDNS 局域网域名")
	flags.StringVar(&cfg.mdnsHost, "mdns-host", envOr("MDNS_HOST", "1726-games"), "mDNS 主机名，例如 1726-games")
	flags.DurationVar(&cfg.disconnectWait, "disconnect-grace", envDuration("DISCONNECT_GRACE", 20*time.Second), "离线玩家保留时长")
	flags.DurationVar(&cfg.confirmationTimeout, "confirmation-timeout", envDuration("CONFIRMATION_TIMEOUT", 60*time.Second), "开局确认超时时长")
	if err := flags.Parse(arguments); err != nil {
		return config{}, err
	}

	cfg.bindAddress = strings.TrimSpace(cfg.bindAddress)
	cfg.port = strings.TrimSpace(cfg.port)
	cfg.roomCode = strings.TrimSpace(cfg.roomCode)
	if cfg.bindAddress == "" {
		cfg.bindAddress = "0.0.0.0"
	}
	if cfg.advertiseHost == "" {
		cfg.advertiseHost = discoverLANHost()
	}
	if err := validatePort(cfg.port); err != nil {
		return config{}, err
	}
	if err := validateRoomCode(cfg.roomCode); err != nil {
		return config{}, err
	}
	if cfg.mdnsEnabled {
		if _, err := discovery.NormalizeHostname(cfg.mdnsHost); err != nil {
			return config{}, err
		}
	}
	if cfg.disconnectWait < time.Second {
		return config{}, fmt.Errorf("disconnect-grace 不能小于 1 秒")
	}
	if cfg.confirmationTimeout < 5*time.Second {
		return config{}, fmt.Errorf("confirmation-timeout 不能小于 5 秒")
	}
	return cfg, nil
}

func buildInviteURL(publicURL, advertiseHost, port, roomCode string) (string, error) {
	base := strings.TrimSpace(publicURL)
	if base == "" {
		base = "http://" + net.JoinHostPort(advertiseHost, port)
	}

	hasCodePlaceholder := strings.Contains(base, "{code}")
	base = strings.ReplaceAll(base, "{code}", roomCode)
	base = strings.ReplaceAll(base, "{port}", port)
	if !strings.Contains(base, "://") {
		base = "http://" + base
	}

	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("public-url 不是有效地址: %q", base)
	}
	if !hasCodePlaceholder {
		parsed.Path = strings.TrimRight(parsed.Path, "/") + "/room/" + roomCode
		parsed.RawQuery = ""
		parsed.Fragment = ""
	}
	return parsed.String(), nil
}

func urlOrigin(value string) (string, error) {
	parsed, err := url.Parse(strings.ReplaceAll(value, "{game}", "who-drinks"))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", fmt.Errorf("无效 URL: %q", value)
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func discoverLANHost() string {
	type candidate struct {
		address string
		score   int
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}

	candidates := make([]candidate, 0)
	for _, networkInterface := range interfaces {
		if networkInterface.Flags&net.FlagUp == 0 || networkInterface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addresses, addressErr := networkInterface.Addrs()
		if addressErr != nil {
			continue
		}
		for _, address := range addresses {
			var ip net.IP
			switch value := address.(type) {
			case *net.IPNet:
				ip = value.IP
			case *net.IPAddr:
				ip = value.IP
			}
			ipv4 := ip.To4()
			if ipv4 == nil || ipv4.IsLoopback() || !ipv4.IsGlobalUnicast() {
				continue
			}

			score := 1
			name := strings.ToLower(networkInterface.Name)
			if ipv4.IsPrivate() {
				score += 50
			}
			if strings.HasPrefix(name, "en") || strings.HasPrefix(name, "eth") || strings.HasPrefix(name, "wlan") {
				score += 40
			}
			if strings.HasPrefix(name, "utun") || strings.Contains(name, "docker") || strings.Contains(name, "bridge") || strings.HasPrefix(name, "veth") || strings.HasPrefix(name, "awdl") || strings.HasPrefix(name, "llw") {
				score -= 80
			}
			if ipv4[0] == 192 && ipv4[1] == 168 {
				score += 15
			} else if ipv4[0] == 10 {
				score += 10
			}
			candidates = append(candidates, candidate{address: ipv4.String(), score: score})
		}
	}

	if len(candidates) == 0 {
		return "127.0.0.1"
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})
	return candidates[0].address
}

func generateRoomCode() (string, error) {
	number, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", number.Int64()), nil
}

func validateRoomCode(code string) error {
	if len(code) != 6 {
		return fmt.Errorf("room-code 必须是 6 位数字")
	}
	for _, char := range code {
		if char < '0' || char > '9' {
			return fmt.Errorf("room-code 必须是 6 位数字")
		}
	}
	return nil
}

func listenOnAvailablePort(bindAddress string, startPort int) (net.Listener, int, error) {
	for port := startPort; port <= 65535; port++ {
		address := net.JoinHostPort(bindAddress, strconv.Itoa(port))
		listener, err := net.Listen("tcp", address)
		if err == nil {
			return listener, port, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, 0, fmt.Errorf("监听 %s: %w", address, err)
		}
	}

	return nil, 0, fmt.Errorf("从端口 %d 开始直到 65535 均不可用", startPort)
}

func validatePort(port string) error {
	value, err := strconv.Atoi(port)
	if err != nil || value < 1 || value > 65535 {
		return fmt.Errorf("port 必须是 1 到 65535 之间的数字")
	}
	return nil
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func printTerminalQRCode(output *os.File, inviteURL string) {
	code, err := qrcode.New(inviteURL, qrcode.Medium)
	if err != nil {
		return
	}
	_, _ = fmt.Fprintln(output)
	_, _ = fmt.Fprintln(output, code.ToSmallString(false))
}
