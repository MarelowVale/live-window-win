# mediactl.ps1 — 控制当前 SMTC 媒体会话
# Action: status | play | pause | toggle | next | prev | seek
param([string]$Action = 'status', [double]$Pos = 0)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

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
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $s = $mgr.GetCurrentSession()
  if (-not $s) { '{"ok":false,"reason":"no session"}'; exit }

  switch ($Action) {
    'status' {
      $pb = $s.GetPlaybackInfo()
      $mp = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      [pscustomobject]@{ ok = $true; status = [string]$pb.PlaybackStatus; title = [string]$mp.Title; artist = [string]$mp.Artist } | ConvertTo-Json -Compress
    }
    'play'   { $r = Await ($s.TryPlayAsync()) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    'pause'  { $r = Await ($s.TryPauseAsync()) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    'toggle' { $r = Await ($s.TryTogglePlayPauseAsync()) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    'next'   { $r = Await ($s.TrySkipNextAsync()) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    'prev'   { $r = Await ($s.TrySkipPreviousAsync()) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    'seek'   { $ticks = [long]([double]$Pos * 10000000); $r = Await ($s.TryChangePlaybackPositionAsync($ticks)) ([bool]); '{"ok":' + $r.ToString().ToLower() + '}' }
    default  { '{"ok":false,"reason":"unknown action"}' }
  }
} catch {
  '{"ok":false,"reason":"' + $_.Exception.Message + '"}'
}
