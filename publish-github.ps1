# OPUS MARKET — saytni GitHub'ga yuklaydi va GitHub Pages'ni yoqadi (Git kerak emas, GitHub CLI yetarli).
# Ishlatish: powershell -ExecutionPolicy Bypass -File publish-github.ps1 -Repo opus-market [-Private]
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [switch]$Private,
  [string]$Message = "Saytni yangilash"
)
# "Continue": gh'ning stderr chiqishi PowerShell 5.1'da xato deb to'xtatib qo'ymasligi uchun; xatolar $LASTEXITCODE orqali tekshiriladi
$ErrorActionPreference = "Continue"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
$root = $PSScriptRoot

$owner = (& $gh api user --jq .login).Trim()
if (-not $owner) { throw "GitHub'ga kirilmagan. Avval: gh auth login" }
$full = "$owner/$Repo"

# 1) Repo yo'q bo'lsa — yaratamiz
& $gh api "repos/$full" --silent 2>$null
if ($LASTEXITCODE -ne 0) {
  $vis = if ($Private) { "true" } else { "false" }
  & $gh api user/repos -X POST -f name=$Repo -f description="OPUS MARKET - kompyuterlar va aksessuarlar onlayn do'koni" -F private=$vis -F auto_init=true --silent
  if ($LASTEXITCODE -ne 0) { throw "Repo yaratilmadi" }
  Write-Host "Repo yaratildi: https://github.com/$full"
  Start-Sleep -Seconds 3
}

# 2) Yuklanadigan fayllar (.gitignore'dagilar va yordamchi papkalarsiz)
$skip = @("deploy", ".claude", ".git")
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  -not ($skip | Where-Object { $rel -like "$_\*" })
}

# Mavjud fayllarning sha'lari (yangilash uchun kerak)
$existing = @{}
try {
  $tree = & $gh api "repos/$full/git/trees/HEAD?recursive=1" | ConvertFrom-Json
  foreach ($t in $tree.tree) { if ($t.type -eq "blob") { $existing[$t.path] = $t.sha } }
} catch {}

$tmp = Join-Path $env:TEMP "opus-upload.json"
$done = 0
foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length + 1) -replace '\\', '/'
  $bytes = [IO.File]::ReadAllBytes($f.FullName)
  # Git blob sha — o'zgarmagan faylni qayta yuklamaymiz
  $hdr = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $sha1 = [Security.Cryptography.SHA1]::Create()
  $blobSha = -join ($sha1.ComputeHash([byte[]]($hdr + $bytes)) | ForEach-Object { $_.ToString("x2") })
  if ($existing[$rel] -eq $blobSha) { continue }

  $body = @{ message = "$Message`: $rel"; content = [Convert]::ToBase64String($bytes) }
  if ($existing.ContainsKey($rel)) { $body.sha = $existing[$rel] }
  [IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  $path = ($rel -split '/' | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
  & $gh api "repos/$full/contents/$path" -X PUT --input $tmp --silent
  if ($LASTEXITCODE -ne 0) { throw "Yuklanmadi: $rel" }
  $done++
  Write-Host "  yuklandi: $rel"
}
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "$done ta fayl yuklandi."

# 3) GitHub Pages'ni yoqamiz (main / root)
& $gh api "repos/$full/pages" --silent 2>$null
if ($LASTEXITCODE -ne 0) {
  [IO.File]::WriteAllText($tmp, '{"source":{"branch":"main","path":"/"}}', (New-Object Text.UTF8Encoding($false)))
  & $gh api "repos/$full/pages" -X POST --input $tmp --silent
  Remove-Item $tmp -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) { Write-Warning "Pages yoqilmadi. Settings > Pages bo'limida qo'lda yoqing (bepul akkauntda repo ochiq bo'lishi kerak)." }
}
$url = (& $gh api "repos/$full/pages" --jq .html_url 2>$null)
Write-Host ""
Write-Host "Repo:  https://github.com/$full"
if ($url) { Write-Host "Sayt:  $url  (birinchi marta 1-2 daqiqada ochiladi)" }
