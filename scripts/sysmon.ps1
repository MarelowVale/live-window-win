# sysmon.ps1 — 每 2 秒输出一行 Base64(UTF-8 JSON)：正在播放媒体(含专辑封面) / 电池 / 网络累计字节
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Drawing

# 专辑封面读取辅助：PS 5.1 下 Thumbnail.OpenReadAsync 返回未投影的 __ComObject
# 无法直接调用（且 STA 线程上会停在 Started）。用 csc 现场编译 C# 辅助类，在 MTA
# 线程上以强类型完成「打开流 → DataReader 读取」全流程。
$thumbReady = $false
try {
  $csPath = Join-Path $PSScriptRoot 'thumbreader.cs'
  if (Test-Path $csPath) {
    $runtimeDir = [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()
    $csc = Join-Path $runtimeDir 'csc.exe'
    $dll = Join-Path $env:TEMP 'LwThumbReader.dll'
    & $csc /nologo /t:library /out:$dll `
      /r:C:\Windows\System32\WinMetadata\Windows.Storage.winmd `
      /r:C:\Windows\System32\WinMetadata\Windows.Foundation.winmd `
      "/r:$runtimeDir\System.Core.dll" "/r:$runtimeDir\System.Runtime.dll" `
      $csPath 2>$null | Out-Null
    if (Test-Path $dll) { Add-Type -Path $dll; $thumbReady = $true }
  }
} catch { $thumbReady = $false }

# 初始化媒体会话管理器（WinRT SMTC）
$mediaReady = $false
try {
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
  function Await($op, $t) {
    $m = $asTaskGeneric.MakeGenericMethod($t)
    $task = $m.Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
  }
  $script:mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $mediaReady = $true
} catch { $mediaReady = $false }

$script:lastCoverKey = $null
$script:lastCover = $null

while ($true) {
  $o = [ordered]@{}

  if ($mediaReady) {
    try {
      $s = $script:mgr.GetCurrentSession()
      if ($s) {
        $mp = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $pb = $s.GetPlaybackInfo()
        $tl = $s.GetTimelineProperties()
        $pos = 0.0; $end = 0.0
        if ($tl) { $pos = [double]$tl.Position.TotalSeconds; $end = [double]$tl.EndTime.TotalSeconds }

        # 专辑封面：仅在歌曲变化时提取一次，缩放为 JPEG(≤256px)
        $key = ([string]$mp.Title) + '|' + ([string]$mp.Artist)
        if ($script:lastCoverKey -ne $key) {
          $script:lastCoverKey = $key
          $script:lastCover = $null
          try {
            $bytes = $null
            if ($thumbReady -and $mp.Thumbnail) { $bytes = [LwMedia.ThumbReader]::Read($mp.Thumbnail) }
            if ($bytes -and $bytes.Length -gt 0) {
              $ms = New-Object System.IO.MemoryStream(,$bytes)
              $img = [System.Drawing.Image]::FromStream($ms)
              $max = 256
              $w = $img.Width; $h = $img.Height
              if ($w -gt $max -or $h -gt $max) {
                $ratio = [Math]::Min($max / $w, $max / $h)
                $nw = [int]($w * $ratio); $nh = [int]($h * $ratio)
                $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
                $g = [System.Drawing.Graphics]::FromImage($bmp)
                $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $g.DrawImage($img, 0, 0, $nw, $nh)
                $g.Dispose(); $img.Dispose()
                $oms = New-Object System.IO.MemoryStream
                $bmp.Save($oms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
                $bmp.Dispose()
                $bytes = $oms.ToArray(); $oms.Dispose()
              } else {
                $oms = New-Object System.IO.MemoryStream
                $img.Save($oms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
                $img.Dispose()
                $bytes = $oms.ToArray(); $oms.Dispose()
              }
              $ms.Dispose()
              $script:lastCover = [Convert]::ToBase64String($bytes)
            }
          } catch { $script:lastCover = $null }
        }

        $o['media'] = [ordered]@{
          title  = [string]$mp.Title
          artist = [string]$mp.Artist
          album  = [string]$mp.AlbumTitle
          status = [string]$pb.PlaybackStatus
          pos    = $pos
          end    = $end
          cover  = $script:lastCover
          app    = [string]$s.SourceAppUserModelId
        }
      }
    } catch {}
  }

  try {
    $b = Get-CimInstance Win32_Battery
    if ($b) { $o['battery'] = [ordered]@{ percent = [int]$b.EstimatedChargeRemaining; charging = ($b.BatteryStatus -eq 2) } }
  } catch {}

  try {
    $a = Get-NetAdapterStatistics | Where-Object { $_.ReceivedBytes -gt 0 -or $_.SentBytes -gt 0 }
    $o['net'] = [ordered]@{
      rx = [double]($a | Measure-Object -Property ReceivedBytes -Sum).Sum
      tx = [double]($a | Measure-Object -Property SentBytes -Sum).Sum
    }
  } catch {}

  $json = $o | ConvertTo-Json -Compress -Depth 5
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
  Write-Output $b64
  Start-Sleep -Milliseconds 2000
}
