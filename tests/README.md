# 验证

## 核心数据逻辑

安装 Node.js 后，在仓库根目录执行：

```bash
npm test
```

不需要安装 npm 依赖。测试覆盖链接往返、评分、回执的所属树及题目版本、去重、本机保存、损坏数据保护、解压尺寸限制与100份成绩上限。

## 真实浏览器流程

浏览器脚本需要 Python、Python Playwright 及其 Chromium 浏览器：

```bash
python -m pip install playwright
python -m playwright install chromium
python -m http.server 8080
```

保持服务器运行，在另一个终端进入仓库根目录：

```bash
python tests/browser_qa.py --url http://127.0.0.1:8080/ --output test-results/browser
```

Windows 如终端编码报错，可在 `python` 后加 `-X utf8`。也可以通过环境变量 `OPENTREE_URL` 与 `OPENTREE_EVIDENCE` 设置网址和输出目录。

脚本使用虚构昵称及彼此隔离的浏览器存储，通过真实点击、输入、下载和文件导入验证创建→邀请→答题→回执→导入→备份恢复的流程。还检查手机宽度、浏览器返回、恶意昵称、安全边界、100人成绩显示及当前访客优先可见。输出 JSON 报告与桌面/手机截图。

这些检查使用无头 Chromium 和手机尺寸模拟，不等同于真实手机或所有浏览器兼容性验收。系统原生分享面板、社交应用对长链接的处理、实时公共数据库不在此测试范围。
