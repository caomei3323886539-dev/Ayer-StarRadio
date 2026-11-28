# 星辉乐章 Alpha 2
基于已确认的七屏概念图及美术资源板：冰蓝、星辉白、浅金与鸢尾紫；城堡、星轨音符、羽笔乐谱、晶心、花饰少女。初版矢量图标已由用户确认的 10 款独立 PNG 与 WebP 背景替换；保留 SVG 历史资源以便回退。原画尺寸经过此前裁切与放大处理，不宣称为原生 384px 绘制。正式 Android 交互仍待实机确认。

独立分支，不发布到主站。新增 tokens/layout/components/navigation 模块，保留历史 CSS 作为兼容层，后续逐页迁移。业务接口、数据库、权限及本地存档结构不变。仅 music.js 本地库导入版本号更新，以匹配离线缓存。云管理页面的视觉重制留待 Alpha 8。

## 已确认原画实装
15 项资源直接从已通过 Android 图片显示验收的 Ayer_Alpha2_Standalone_Preview.html 提取，保持字节内容不变。十款 PNG 和 WebP 背景替换导航显示；星晶用于品牌，金色分隔线用于弹窗。顶部菜单、搜索为新绘制矢量资源。正式音乐页面仍待实际设备验证。

测试：在独立分支 checkout 后，使用 python -m http.server 8080 启动，在浏览器打开 http://localhost:8080/music.html。该完整页面使用现有云端服务，测试写入会作用于真实账户，请先使用游客模式或测试账号。不得在生产主分支部署测试版。

## 测试中心
通过分支 Actions 下载 Ayer_Alpha2_Test_Site，解压，在根目录运行 python -m http.server 8080。打开 http://localhost:8080/alpha2-preview.html 先检查纯 UI；通过页面入口进入完整音乐界面。手机可使用电脑同一局域网 IP:8080（HTTP 环境不能验证 PWA 安装）。真实云账户写入需谨慎。主站未部署。原画 15 项已按 Git blob SHA 与验收 ZIP 核对，完全一致。

## 自动化验收
- `tests/alpha2-artwork.test.cjs` 使用 Git blob SHA-1 验证 15 项已确认原画字节内容、导航 PNG 尺寸及离线缓存引用。
- `Validate Alpha 2 UI` 在 320 / 390 / 480 / 1366 CSS px 下运行独立预览与完整音乐页面的浏览器测试；自动化禁止访问外部云服务，使用全新浏览器存储。
- 浏览器模拟不是 Android 真机验收。实际播放、账号同步、云端写入与 PWA 安装需另行验收。

## C1.2 独立在线部署准备
修正 C1.1 版本参数、导航原画缓存断言及浏览器跳转检查与实际源码不一致的问题。保留所有测试门槛，尚待新 CI 结果。在线测试应使用独立 HTTPS origin（例如独立 Vercel 项目），绑定 ui/v1.0.0-alpha2 分支，不切换正式站 Pages 来源，不共享正式站 Service Worker 或 IndexedDB。测试域名的本地库为空属于浏览器隔离，勿清除正式站数据；先以游客模式验收，真实云账号写入会影响原数据。尚未配置独立托管服务，不能宣称已上线。
