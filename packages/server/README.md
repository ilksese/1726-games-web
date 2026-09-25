# @games/server

Go 1.22+ 编写的局域网私密组队房间服务器。服务启动后会创建随机 6 位房间号，发布 mDNS 局域网域名，并在终端输出邀请链接和二维码。

## 一键启动

在仓库根目录执行：

```bash
pnpm lan:dev
```

该命令会同时启动：

- Vite 游戏前端：`http://<局域网主机>:5173`
- Go 房间服务：默认从 `5174` 开始寻找可用端口

默认情况下，房间服务会尝试发布：

```text
http://1726-games.local:<端口>/room/<房间号>
```

终端和房间页面也会同时展示局域网 IP 备用地址。若网络不支持 mDNS，可直接使用 IP 地址或关闭 mDNS。

仅启动 Go 服务：

```bash
pnpm server:dev
```

## 完整组队流程

1. 玩家通过二维码、mDNS 地址或 IP 地址进入房间。
2. 第一个加入的玩家自动成为队长。
3. 队长设置“谁喝酒”的卡牌数量和酒杯数量。
4. 队长发起开局确认，所有在线玩家同时收到确认弹窗。
5. 所有玩家同意后，进入游戏选择阶段。
6. 队长选择“谁喝酒”。
7. 所有玩家自动进入同一个服务端权威牌局。
8. 任意玩家翻牌后，翻牌位置、结果和操作者会同步到所有设备。
9. 翻出酒杯时，所有设备同时进入结果确认状态。
10. 本轮结束后可以开始下一轮；队长也可以重新开启房间，回到配置阶段。

## 房间生命周期

```text
waiting
  -> confirming
  -> game-select
  -> started
  -> finished
  -> started       下一轮
  -> waiting       重新开启房间
```

规则：

- 至少需要 2 名在线玩家才能发起开局。
- 只有队长能修改配置、发起开局、选择游戏和重新开启房间。
- 任意玩家拒绝或在确认阶段掉线，本次开局会取消。
- 开局确认默认 60 秒超时，超时后返回等待状态。
- 队长离开后，按加入顺序自动移交给下一位玩家。
- 玩家名字是房间内唯一身份。名字已被占用时拒绝加入。
- 客户端只保存自己的名字和本机重连钥匙。别人只有名字，不能接管这个席位。
- 牌局和房间状态只保存在服务端。玩家断线重连后，由服务端重新下发当前全员状态。
- 玩家短暂断线会保留席位；默认离线 20 秒后自动移出房间。
- 游戏牌组由 Go 服务端生成，客户端只能看到已经翻开的牌。
- 相同卡牌不能重复翻开，并发操作由服务端串行校验。

## 常用配置

可通过命令行参数或同名环境变量配置：

| 参数 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `-port` | `PORT` | `5174` | HTTP 起始监听端口 |
| `-bind` | `BIND_ADDRESS` | `0.0.0.0` | HTTP 监听地址 |
| `-advertise-host` | `ADVERTISE_HOST` | 自动探测 | mDNS A/AAAA 记录和 IP 邀请地址使用的主机 |
| `-mdns` | `MDNS_ENABLED` | `true` | 是否发布 mDNS 服务 |
| `-mdns-host` | `MDNS_HOST` | `1726-games` | mDNS 主机名，最终域名为 `<值>.local` |
| `-public-url` | `PUBLIC_URL` | 自动生成 | 自定义邀请地址；支持 `{code}`、`{port}` |
| `-web-url` | `WEB_URL` | `<局域网主机>:5173` | 游戏前端根地址 |
| `-game-url` | `GAME_URL` | `<web-url>/{game}` | 游戏跳转地址；支持 `{game}`、`{room}` |
| `-room-code` | `ROOM_CODE` | 随机 6 位数字 | 固定房间号 |
| `-disconnect-grace` | `DISCONNECT_GRACE` | `20s` | 离线玩家保留时间 |
| `-confirmation-timeout` | `CONFIRMATION_TIMEOUT` | `60s` | 全员确认超时时间 |

`-port` 是起始端口。如果端口被占用，服务会依次尝试下一个端口，并让二维码、邀请链接和 API 地址使用最终端口。

例如：

```bash
pnpm lan:dev -- \
  --advertise-host 192.168.1.20 \
  --mdns-host 1726-games
```

关闭 mDNS：

```bash
pnpm lan:dev -- --mdns=false
```

自定义前端地址：

```bash
pnpm server:dev -- \
  --web-url http://192.168.1.20:5173
```

## API

房间阶段：

```text
GET  /api/rooms/{code}
POST /api/rooms/{code}/join
POST /api/rooms/{code}/config
POST /api/rooms/{code}/start
POST /api/rooms/{code}/confirm
POST /api/rooms/{code}/cancel-start
POST /api/rooms/{code}/select-game
POST /api/rooms/{code}/reopen
POST /api/rooms/{code}/leave
GET  /api/rooms/{code}/events
```

游戏阶段：

```text
GET  /api/rooms/{code}/game
GET  /api/rooms/{code}/game/hand
POST /api/rooms/{code}/game/action
```

游戏操作类型：

```text
flip
continue
next-round
win
end-round
respond
play
```

万象麻将的手牌不在 SSE 快照里。客户端用 `X-Player-Name` / `X-Player-Key` 调 `GET /api/rooms/{code}/game/hand`，只拿到自己的 `{"cards":[...]}`。

## 验证

```bash
pnpm typecheck
pnpm build
pnpm server:test
pnpm server:build
```
