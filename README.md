# Ayer Star Radio v0.4.2

星光音乐空间：独立播放页、播放队列、歌词/LRC、排序、动态星光。

部署：将 index.html、sw.js、manifest.webmanifest、icon.svg 上传至 GitHub Pages 仓库根目录。

兼容性：继续使用 IndexedDB `ayer-star-radio` v2，保留歌曲、收藏、歌单。请勿清除站点数据。

注意：歌词存储在歌曲元数据中，浏览器可能限制后台播放。

## v0.4.2
- 播放队列支持上移、下移、移除（不删除本地歌曲）
- 音乐库排序选项会保存在当前浏览器

## v0.4.2
- LRC 时间歌词支持点击跳转播放位置
- 播放队列触控按钮布局优化
- 完整播放页总时长同步修复
