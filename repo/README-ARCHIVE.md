# 仓库级资产归档

本目录存放 **GitHub 仓库级资产**，不属于 Mavis skill 包本体。

- **skill 包本体** = 上一层的 `SKILL.md` + `references/` + `scripts/`（模型执行所需，也是安装进 Mavis 的部分）
- **本目录** = 面向人与仓库工程的文件：`README.md` / `README.en.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` / `LICENSE`、`.github/`（CI 与 issue 模板）、`.claude-plugin/`（marketplace 清单）、`evals/`（结构回归 + 行为 eval + fixtures）、`docs/`（项目文档）

**搬移原因**：skill-creator 规定 skill 目录只放模型执行需要的文件；README/CHANGELOG 这类面向人的文档留在 skill 包内会占模型 context，且会被 lint 判为禁文件。

**可逆性**：本次搬移**未提交**。仓库根的 `.git` 与 `.gitignore` 留在原位（git 历史与忽略规则完整），用 `git checkout -- .` 即可把文件还原到仓库根。

**权威正文**：skill 执行规约一律以上一层为准，本目录只作归档与工程参考。
