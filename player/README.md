# 房价牌播放器（Windows 版）

为酒店前台 Win7 电脑做的播放器：主屏（VGA 普通显示器）显示控制窗口，点「播放」即在 HDMI 电视（竖屏）全屏展示房价牌，点「停止」关闭。服务端仍跑在家里的 Ubuntu 服务器上，无需改动后端。

## 使用

1. 把打包好的文件夹（含 `innboard-player.exe`）解压到任意位置。
2. 双击 `innboard-player.exe`。
3. 首次运行时，确认「服务器地址」为 `https://hotel.binbino.cn`（不要带 `/display`），点「保存」。
4. 点「▶ 播放」→ 电视全屏显示房价牌；点「■ 停止」→ 关闭电视画面。
5. 点「打开管理后台」→ 在浏览器里改房价 / 图片 / 公告，电视 30 秒内自动更新。

## 常见问题

- **画面没出现在电视上**：确认 HDMI 电视已连接、系统里设为「扩展」显示、方向设为竖屏。播放器会自动在「非主屏」上全屏。
- **电视黑屏/无法连接**：检查网络能访问 `https://hotel.binbino.cn`，电视画面里点「重新连接」。
- **想开机自动播放**：把 `innboard-player.exe` 的快捷方式放到「开始菜单 → 启动」文件夹，然后手动点一次「播放」即可（或后续版本支持自动播放）。

## 开发 / 构建

```bash
cd player
npm install
npm start              # 本机调试
npm run build:win      # 交叉构建 Windows x64 版（无需 Wine，输出到 dist/）
```

> 构建产物在 `player/dist/innboard-player-win32-x64/`，整个文件夹拷到 Win7 即可运行；
> 或直接分发压缩包 `player/dist/innboard-player-win32-x64.zip`。
> Electron 版本固定为 22.3.27（最后一个支持 Win7 的版本），请勿升级。
