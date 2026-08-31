# @games/server

Go 1.22+ 编写的局域网私密组队房间服务器。每次启动会创建一个随机 6 位房间号，并在终端输出局域网邀请链接和二维码。

## 启动

在仓库根目录执行：

```bash
pnpm server:dev
```

同一局域网内的玩家扫描终端二维码或打开邀请链接即可加入。第一个加入的玩家自动成为队长。

## 房间规则

- 只有队长能发起开局。
- 发起开局时，当前所有在线玩家会同时收到确认弹窗。
- 任意玩家拒绝或在确认期间掉线，本次开局都会取消。
- 只有所有玩家均同意后，房间状态才会切换为 `started`。
- 队长离开后，按加入顺序自动移交给下一位玩家。
- 玩家短暂断线会保留会话；默认离线 20 秒后自动移出房间。

## 常用配置

可通过命令行参数或同名环境变量配置：

| 参数 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `-port` | `PORT` | `5174` | HTTP 监听端口 |
| `-bind` | `BIND_ADDRESS` | `0.0.0.0` | HTTP 监听地址 |
| `-advertise-host` | `ADVERTISE_HOST` | 自动探测 | 二维码中使用的局域网 IP/主机名 |
| `-public-url` | `PUBLIC_URL` | 自动生成 | 邀请根地址；可用 `{code}` 放置房间号 |
| `-room-code` | `ROOM_CODE` | 随机 6 位数字 | 固定房间号 |
| `-game-url` | `GAME_URL` | 空 | 全员确认后跳转地址；可用 `{room}` 放置房间号 |
| `-disconnect-grace` | `DISCONNECT_GRACE` | `20s` | 离线玩家保留时间 |

`-port` 是起始端口。如果该端口已被占用，服务器会自动依次尝试下一个端口，并让终端二维码、邀请链接和本机入口使用最终选中的端口。

例如，全员确认后统一进入数字侦探：

```bash
pnpm server:dev -- --game-url http://192.168.1.20:5173/number-detective
```

如果自动探测到了虚拟网卡地址，可显式指定真实局域网 IP：

```bash
pnpm server:dev -- --advertise-host 192.168.1.20
```

## 验证

```bash
pnpm server:test
pnpm server:build
```
