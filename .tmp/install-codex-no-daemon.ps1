$ErrorActionPreference = 'Stop'
$cliPath = 'C:\Users\YUMIN\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe'
$configPath = 'C:\Users\YUMIN\.codex\config.toml'
$backupPath = 'F:\mujicatimelineweb\.tmp\codex-config-before-no-daemon.toml'
if (-not (Test-Path -LiteralPath $cliPath)) { throw 'Codex CLI not found' }
if (Test-Path -LiteralPath $backupPath) { throw 'Backup already exists; original will not be overwritten' }
Copy-Item -LiteralPath $configPath -Destination $backupPath
& $cliPath features disable daemon_auto_start
if ($LASTEXITCODE -ne 0) { throw 'Codex feature update failed' }
$featureResult = & $cliPath features list
if (-not ($featureResult -match '^daemon_auto_start\s+stable\s+false')) { throw 'Feature verification failed' }
$desktopPath = [Environment]::GetFolderPath('Desktop')
$linkPath = Join-Path $desktopPath 'Codex - No Daemon.lnk'
if (Test-Path -LiteralPath $linkPath) { throw 'Shortcut already exists; refusing to overwrite' }
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcut = $shortcutShell.CreateShortcut($linkPath)
$shortcut.TargetPath = $cliPath
$shortcut.Arguments = '--no-daemon -C "F:\mujicatimelineweb" resume --last'
$shortcut.WorkingDirectory = 'F:\mujicatimelineweb'
$shortcut.Description = 'Resume Codex without the background daemon; elevated sandbox stays enabled.'
$shortcut.IconLocation = $cliPath + ',0'
$shortcut.Save()
$verified = $shortcutShell.CreateShortcut($linkPath)
if ($verified.TargetPath -ne $cliPath -or $verified.Arguments -ne $shortcut.Arguments) { throw 'Shortcut verification failed' }
[pscustomobject]@{ Shortcut=$linkPath; Arguments=$verified.Arguments; ConfigBackup=$backupPath; DaemonAutoStart=$false } | ConvertTo-Json
