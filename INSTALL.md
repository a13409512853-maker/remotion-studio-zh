# 安装说明：供用户与 AI 阅读

目标是安装一次独立扩展，后续由 Codex 自动以中文打开 Remotion Studio。
只在官方 Remotion 技能中添加有标记的短接入段落，保留原技能其余内容；无需遍历并修改所有视频项目。

## 条件

- 本地 Codex 支持 `codex plugin` 命令。
- Node.js 22.12 或更新版本，npm 可用。
- 仓库在可长期保留的位置，避免临时下载目录。
- 操作用户对 Codex 插件注册信息和 Remotion 技能有写入授权；全局 `AGENTS.md` 仅作为局部写入被拒绝时的备选。

本地 Windows 端到端流程已验证；其他平台需先检查自己的 Codex CLI 和路径。

## 交给 AI 时

用户提供本仓库链接并请求安装后：

1. 克隆或下载当前仓库到用户的持久工具目录。读取 README、此文件和 `scripts/install-local.cjs`。
2. 确认当前用户的实际 Codex 配置目录；支持 `CODEX_HOME`，没有设置时使用用户目录下 `.codex`。
3. 查找已安装的 Codex 原生可执行文件，或 npm 安装的 `@openai/codex/bin/codex.js`。Windows 的 `.cmd` 是命令包装器，不要把它当原生可执行文件传给安装器。
4. 在仓库根目录运行 `npm ci --ignore-scripts`，再运行 `npm test` 和 `npm run check`。
5. 在获得必要文件写入权限后运行 `node scripts/install-local.cjs "<实际 Codex 路径>"`。
6. 用同一个 Codex 执行 `plugin list --marketplace remotion-zh-local --json`，核对 `installed` 与 `enabled`。
7. 如果用户提供了 Remotion 项目，用启动器运行 `doctor`；在已授权的情况下打开一次中文 Studio 验证。有项目缺失、权限或浏览器障碍时，明确区分“扩展已安装”和“界面验证未完成”。

安装器会备份 Codex 配置及被修改的技能，安装独立插件，然后优先接入 Remotion 入口与 Studio 技能。局部接入成功时，清除旧版自己的全局段落；只在局部写入被权限拒绝时才使用全局备选。没有找到 Remotion 插件时仅安装独立扩展，不为了缺少插件而添加全局指令。保留已有内容和其他插件，不展示或上传配置中的敏感信息。

用户没有要求创建视频时，无需为了安装扩展生成视频项目。

## 常用命令

```powershell
npm ci --ignore-scripts
npm test
npm run check
node scripts/install-local.cjs "<codex.js 或原生 Codex 可执行文件绝对路径>"
```

验证现有工程：

```powershell
node scripts/launch.cjs doctor --project "<Remotion 工程根目录>"
node scripts/launch.cjs studio --project "<Remotion 工程根目录>" -- src/index.ts
```

可保留原来的 `--config`、端口和 `--rspack` 等参数，放在分隔符 `--` 之后。
入口文件以项目实际情况为准。

## 完成标准

- 本地插件列表显示已安装、已启用。
- 正常情况下 Remotion 技能中各有一个局部接入标记，全局指令中没有本扩展的段落，原技能与用户指令保持完整。
- 如果用了全局备选，必须说明被拒绝的局部文件与回退结果；不能把它描述成已经完成局部接入。
- 运行目录可长期访问，插件 `runtime.json` 正确指向它。
- 有测试项目时，中文界面可见且项目视频文字保持原样。

新建聊天后可发现配套插件技能。正常路由只在 AI 读取 Remotion 功能时加载。
官方插件更新可能替换局部指引；再次调用扩展时会检测并修复，也可以运行
`npm run routing:repair`。默认没有后台修补或全局常驻段落，不能承诺未来更新
后在从未再次调用扩展的情况下也一定自动恢复。外部终端的普通 Remotion 命令
不会被系统级拦截。
