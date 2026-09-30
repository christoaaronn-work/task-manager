Add-Type -Namespace W -Name K -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int v);'
$skip = @(0x10,0x11,0x12,0xA0,0xA1,0xA2,0xA3,0xA4,0xA5)
$keys = 8..254 | Where-Object { $skip -notcontains $_ }
function Down($v){ ([W.K]::GetAsyncKeyState($v) -band 0x8000) -ne 0 }
$armed = $false
while ($true) {
  $ctrl = (Down 0x11); $alt = (Down 0x12)
  if ($ctrl -and $alt) {
    if (-not $armed) { $armed = $true; $dirty = $false }
    if (-not $dirty) { foreach ($k in $keys) { if (Down $k) { $dirty = $true; break } } }
  } elseif ($armed) {
    if (-not $ctrl -and -not $alt) {
      if (-not $dirty) { [Console]::Out.WriteLine('tap'); [Console]::Out.Flush() }
      $armed = $false
    } elseif (-not $dirty) {
      # one modifier released early: still counts if the other is released without another key
    }
  }
  Start-Sleep -Milliseconds 25
}
