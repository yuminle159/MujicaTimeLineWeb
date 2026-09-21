# 发布说明

`main` 是源码分支；`deploy` 是只包含可公开网站文件的发布分支。服务器只需要检出 `deploy`。

## 日常发布

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
git clone --branch deploy --single-branch https://github.com/yuminle159/MujicaTimeLineWeb.git /var/www/mujica-site
```

将 Web 服务器根目录设置为 `/var/www/mujica-site`。以后更新只需：

```bash
cd /var/www/mujica-site
git pull --ff-only origin deploy
```

服务器不需要 Python、Excel 或数据生成工具。

注意：同一 GitHub 仓库内所有分支具有相同的公开／私有属性。`deploy` 分支可以隔离服务器文件，但不能在公开仓库中隐藏 `main` 的源码；如需隐藏源码，应使用两个不同仓库。
