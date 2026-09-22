# 发布说明

`main` 是源码分支；`deploy` 是只包含可公开网站文件的发布分支。服务器只需要检出 `deploy`。

## 日常发布

推荐直接双击 `wijipedia_数据更新工具.exe`：

1. 点击「① 同步项目」。
2. 编辑 Excel／Markdown，点击「② 完整更新并预览」。工具会依次备份 Excel、执行项目体检、重新生成全部数据与搜索索引、生成内容变更报告、构建 `dist/`，随后直接打开 `dist/index.html`，预览实际发布内容。
3. 点击「③ 提交并发布」，输入本次提交说明。

第三步会自动提交并推送 `main`、生成发布目录、更新并推送 `deploy`。若任一步失败，工作流会停止并在日志中显示原因。
此时可点击「重试：失败步骤及后续」，工具只会从失败步骤继续，不会重复已经完成的提交、构建或推送。

「维护工具」区域中的三个新增辅助入口：

- 「项目体检」只检查表格结构、日期、重复项、跨表引用以及图片／Markdown 资源，不修改文件。
- 「查看变更报告」对比当前生成内容与 Git HEAD，并将报告保存到 `_reports/`。
- 「仅重新生成 data」完成后，以及点击「打开本地预览」时，会打开项目根目录的 `index.html`。

每次完整更新前的 Excel 备份保存在 `_backups/日期时间/`；这两个维护目录均不会提交到 Git。

以下命令行方式作为备用：

更新数据并确认页面无误后，先提交并推送源码：

```powershell
git add .
git commit -m "更新网站"
git push origin main
```

再生成发布目录、创建发布提交并推送 `deploy`：

```powershell
python publish_deploy.py --push
```

发布脚本不会切换当前分支，也不会修改 `main` 的工作区。默认要求工作区已提交，避免发布内容与源码版本不一致。

只想在本地生成并检查发布目录时，可运行：

```powershell
python build_site.py
```

`dist/` 是临时生成物，不提交到 `main`。`deploy` 分支的根目录直接对应 `dist/` 的内容。

## 部署

服务器首次部署建议克隆发布分支到独立目录：

```bash
git clone --branch deploy --single-branch https://github.com/yuminle159/MujicaTimeLineWeb.git /var/www/MujicaTimeLineWeb-deploy
```

将 Web 服务器根目录设置为 `/var/www/MujicaTimeLineWeb-deploy`。以后更新只需：

```bash
cd /var/www/MujicaTimeLineWeb-deploy
git pull --ff-only origin deploy
```

服务器不需要 Python、Excel 或数据生成工具。

注意：同一 GitHub 仓库内所有分支具有相同的公开／私有属性。`deploy` 分支可以隔离服务器文件，但不能在公开仓库中隐藏 `main` 的源码；如需隐藏源码，应使用两个不同仓库。
