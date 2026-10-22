# OPUS MARKET — ilova ikonkalarini yasaydi (icons/ papkasiga PNG).
Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$dir = Join-Path $root "icons"
New-Item -ItemType Directory -Force $dir | Out-Null

function New-Icon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = [single]$size

  # Fon shakli: maskable — to'liq kvadrat, oddiy — yumaloq burchakli kvadrat
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  if ($maskable) { $path.AddRectangle((New-Object System.Drawing.RectangleF 0, 0, $s, $s)) }
  else {
    $r = $s * 0.225; $d = $r * 2
    $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($s - $d, 0, $d, $d, 270, 90)
    $path.AddArc($s - $d, $s - $d, $d, $d, 0, 90); $path.AddArc(0, $s - $d, $d, $d, 90, 90); $path.CloseFigure()
  }

  # Qizil gradient fon
  $rect = New-Object System.Drawing.RectangleF 0, 0, $s, $s
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 255, 72, 52)), ([System.Drawing.Color]::FromArgb(255, 122, 4, 20)), 55.0
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $blend.Colors = @([System.Drawing.Color]::FromArgb(255, 255, 77, 46), [System.Drawing.Color]::FromArgb(255, 225, 15, 42), [System.Drawing.Color]::FromArgb(255, 110, 3, 18))
  $blend.Positions = @([single]0, [single]0.5, [single]1)
  $bg.InterpolationColors = $blend
  $g.FillPath($bg, $path)
  $g.SetClip($path)

  # Yuqori chap burchakdagi yumshoq yorug'lik
  $hl = New-Object System.Drawing.Drawing2D.GraphicsPath
  $hl.AddEllipse(-$s * 0.35, -$s * 0.45, $s * 1.1, $s * 0.95)
  $hb = New-Object System.Drawing.Drawing2D.PathGradientBrush $hl
  $hb.CenterColor = [System.Drawing.Color]::FromArgb(70, 255, 255, 255)
  $hb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
  $g.FillPath($hb, $hl)

  # Halqa (maskable'da xavfsiz zona ichida kichikroq)
  $k = if ($maskable) { 0.62 } else { 0.78 }
  $ringR = $s * 0.26 * $k / 0.78 * 1.0
  $stroke = $s * 0.115 * $k / 0.78
  $cx = $s / 2; $cy = $s / 2

  # Halqa soyasi / nuri
  for ($i = 6; $i -ge 1; $i--) {
    $glow = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(10, 60, 0, 8)), ($stroke + $s * 0.018 * $i)
    $g.DrawEllipse($glow, $cx - $ringR, $cy - $ringR + $s * 0.02, $ringR * 2, $ringR * 2)
    $glow.Dispose()
  }
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $stroke
  $g.DrawEllipse($pen, $cx - $ringR, $cy - $ringR, $ringR * 2, $ringR * 2)

  # Halqadagi kichik qizil "kesik" — harakat/quvvat belgisi
  $dot = $stroke * 0.42
  $ang = -40 * [Math]::PI / 180
  $dx = $cx + [Math]::Cos($ang) * $ringR; $dy = $cy + [Math]::Sin($ang) * $ringR
  $db = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 200, 8, 30))
  $g.FillEllipse($db, $dx - $dot, $dy - $dot, $dot * 2, $dot * 2)

  $g.Dispose()
  $bmp.Save((Join-Path $dir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "{0,-28} {1}x{1}" -f $file, $size
}

New-Icon 512 "icon-512.png" $false
New-Icon 192 "icon-192.png" $false
New-Icon 512 "icon-maskable-512.png" $true
New-Icon 180 "apple-touch-icon.png" $true
New-Icon 32 "favicon-32.png" $false
