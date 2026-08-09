# 安全说明

本仓库是 Agent Skill 指令集（Markdown + 少量只读 Python 校验脚本），不处理用户敏感数据，无网络攻击面。

## 报告漏洞

- **敏感安全问题**：使用 GitHub 的私有漏洞报告（仓库页 → Security → Report a vulnerability），**不要**开公开 issue
- **一般问题**：开 issue 或进 Discussions

## 安全承诺

- SKILL.md 不诱导 agent 执行破坏性命令；危险操作必须带二次确认
- `evals/` 脚本只读、跨平台、纯 stdlib，不访问网络
- 不收集、不上传任何用户数据
