# OPUS MARKET — Claude Artifact uchun sahifa versiyasini yasaydi (deploy/index.html).
# Artifact platformasi <!DOCTYPE>, <html>, <head>, <body> va charset/viewport metalarini o'zi qo'shadi.
$root = $PSScriptRoot
$html = Get-Content -Raw -Encoding utf8 (Join-Path $root "index.html")
$html = $html -replace '(?i)<!DOCTYPE html>\s*', ''
$html = $html -replace '(?i)</?html[^>]*>\s*', ''
$html = $html -replace '(?i)</?head>\s*', ''
$html = $html -replace '(?i)</?body>\s*', ''
$html = $html -replace '(?i)\s*<meta charset="UTF-8" />', ''
$html = $html -replace '(?i)\s*<meta name="viewport"[^>]*/>', ''
$out = Join-Path $root "deploy"
New-Item -ItemType Directory -Force $out | Out-Null
[IO.File]::WriteAllText((Join-Path $out "index.html"), $html.Trim(), (New-Object Text.UTF8Encoding($false)))
"deploy/index.html tayyor ({0:N0} bayt)" -f (Get-Item (Join-Path $out "index.html")).Length
