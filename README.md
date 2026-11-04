<p align="right">
  <strong>简体中文</strong> | <a href="README_EN.md">English</a>
</p>

<p align="center">
  <img src="public/banner.png" alt="立方" width="520" />
</p>

<p align="center">
  智能魔方的在线练习与成绩分析工具
</p>

<p align="center">
  <a href="https://lifang.io">LIFANG.IO（在线体验）</a>
  ·
  <a href="CHANGELOG.md">更新记录</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v0.1.8-4b7bec" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6-3178c6" />
  <img alt="GAN Smart Cube" src="https://img.shields.io/badge/GAN-Smart_Cube-55a86b" />
</p>

![练习界面](./public/practice.jpg)

## 系统支持

| 系统 | 支持状态 | 推荐浏览器 | 说明 |
| --- | --- | --- | --- |
| Windows 10 / 11 | ✅ 支持 | Chrome、Edge | - |
| macOS | ✅ 支持 | Chrome、Edge | - |
| ChromeOS | ✅ 支持 | Chrome | - |
| Android 6.0 及以上 | ✅ 支持 | Chrome | - |
| iOS / iPadOS | ✅ 支持 | Bluefy | iPhone、iPad 需使用 Bluefy 浏览器连接智能魔方 |
| Linux | ⚠️ 实验性支持 | Chrome、Chromium | 可能需要在浏览器中启用实验性 Web Platform 功能 |

## 功能

- 通过 Web Bluetooth 连接 GAN 智能魔方
- 三维魔方同步、计时练习与专项训练
- CFOP 公式浏览、筛选与练习
- 记录首次 OLL、PLL 情景，支持情景名称与示意图悬浮预览
- 专项练习默认 20 轮，支持轮数设置、自动结束与复原成功率统计
- 成绩趋势、阶段用时与练习热力图
- 中英文界面与本地数据存档

> [!NOTE]
> 当前仅支持 GAN 智能魔方。电脑和安卓设备建议使用支持 Web Bluetooth 的 Chromium 浏览器；iPhone、iPad 需使用 Bluefy 浏览器。

## 技术栈

Next.js · React · TypeScript · Three.js · GAN Web Bluetooth

## 致谢

感谢 [afedotov/gan-web-bluetooth](https://github.com/afedotov/gan-web-bluetooth) 提供 GAN 智能魔方的 Web Bluetooth 支持。
