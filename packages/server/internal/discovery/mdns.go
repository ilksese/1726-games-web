package discovery

import (
	"fmt"
	"net"
	"regexp"
	"strings"

	mdns "github.com/hashicorp/mdns"
)

const (
	serviceType = "_http._tcp."
	localDomain = "local."
)

var hostnamePattern = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

type Advertisement struct {
	server   *mdns.Server
	hostname string
	port     int
}

func Register(hostname, advertiseHost string, port int, roomCode string) (*Advertisement, error) {
	normalizedHostname, err := normalizeHostname(hostname)
	if err != nil {
		return nil, err
	}
	if port < 1 || port > 65535 {
		return nil, fmt.Errorf("mDNS 端口无效: %d", port)
	}

	ips, err := resolveIPs(advertiseHost)
	if err != nil {
		return nil, err
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("找不到可用于 mDNS 的局域网地址: %s", advertiseHost)
	}

	serviceName := "1726 Games"
	if roomCode != "" {
		serviceName = fmt.Sprintf("1726 Games (%s)", roomCode)
	}
	service, err := mdns.NewMDNSService(
		serviceName,
		serviceType,
		localDomain,
		normalizedHostname+".local.",
		port,
		ips,
		[]string{
			"version=1",
			"room=" + roomCode,
			"path=/room/" + roomCode,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("创建 mDNS 服务: %w", err)
	}

	server, err := mdns.NewServer(&mdns.Config{Zone: service})
	if err != nil {
		return nil, fmt.Errorf("启动 mDNS 服务: %w", err)
	}

	return &Advertisement{
		server:   server,
		hostname: normalizedHostname,
		port:     port,
	}, nil
}

func (a *Advertisement) Hostname() string {
	if a == nil {
		return ""
	}
	return a.hostname + ".local"
}

func (a *Advertisement) URL(roomCode string) string {
	if a == nil {
		return ""
	}
	return "http://" + net.JoinHostPort(a.Hostname(), fmt.Sprintf("%d", a.port)) + "/room/" + roomCode
}

func (a *Advertisement) Close() {
	if a == nil || a.server == nil {
		return
	}
	_ = a.server.Shutdown()
}

// NormalizeHostname validates and normalizes a single mDNS host label.
func NormalizeHostname(hostname string) (string, error) {
	return normalizeHostname(hostname)
}

func normalizeHostname(hostname string) (string, error) {
	name := strings.TrimSpace(strings.ToLower(hostname))
	name = strings.TrimSuffix(name, ".")
	name = strings.TrimSuffix(name, ".local")
	if name == "" {
		return "", fmt.Errorf("mDNS 主机名不能为空")
	}
	if len(name) > 63 || !hostnamePattern.MatchString(name) {
		return "", fmt.Errorf("mDNS 主机名必须是单个合法域名标签: %q", hostname)
	}
	return name, nil
}

func resolveIPs(host string) ([]net.IP, error) {
	value := strings.TrimSpace(host)
	if value == "" {
		return nil, fmt.Errorf("mDNS 广播地址不能为空")
	}
	if ip := net.ParseIP(value); ip != nil {
		return []net.IP{ip}, nil
	}

	addresses, err := net.LookupIP(value)
	if err != nil {
		return nil, fmt.Errorf("解析 mDNS 广播地址 %q: %w", value, err)
	}
	result := make([]net.IP, 0, len(addresses))
	seen := make(map[string]struct{})
	for _, address := range addresses {
		text := address.String()
		if _, ok := seen[text]; ok {
			continue
		}
		seen[text] = struct{}{}
		result = append(result, address)
	}
	return result, nil
}
