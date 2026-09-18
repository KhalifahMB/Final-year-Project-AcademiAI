$ErrorActionPreference = 'Stop'
$f = 'C:\Users\El-kufahn\Downloads\academiai\academiai\frontend\src\components\resources\ResourcePreview.jsx'
$s = [System.IO.File]::ReadAllText($f, [System.Text.UTF8Encoding]::new($false))
"bytes={0} chars={1} lines={2}" -f ([Text.Encoding]::UTF8.GetByteCount($s)), $s.Length, ($s -split "`n").Count

# 1) Brace / paren / bracket balance
$open = ($s.ToCharArray() | Where-Object { $_ -eq '{' }).Count
$close = ($s.ToCharArray() | Where-Object { $_ -eq '}' }).Count
$po = ($s.ToCharArray() | Where-Object { $_ -eq '(' }).Count
$pc = ($s.ToCharArray() | Where-Object { $_ -eq ')' }).Count
$bo = ($s.ToCharArray() | Where-Object { $_ -eq '[' }).Count
$bc = ($s.ToCharArray() | Where-Object { $_ -eq ']' }).Count
"braces {open}/{close}  parens {po}/{pc}  brackets {bo}/{bc}" -f $open,$close,$po,$pc,$bo,$bc
if ($open -ne $close -or $po -ne $pc -or $bo -ne $bc) { "UNBALANCED"; exit 1 }

# 2) No silent-corruption tokens (bytes our writer never authors)
$bad = @('enet', 'opera', 'ERROR;', 'null蒽', 'Bwk0tEme', ', ndata', 'cancelled = true', 'CANNOT', 'forwardRef(forwardRef', '@@')
foreach ($t in $bad) {
  $n = ([regex]::Matches($s, [regex]::Escape($t))).Count
  if ($n -gt 0) { "TOKEN-COLLISION: {0} x{1}" -f $t, $n }
}

# 3) Key symbols present exactly once where required
$once = @('import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from', 'import { renderDocument } from', "api.get(", "responseType: 'blob'", 'onLoad: () =>', 'useImperativeHandle(ref, () => ({', 'restore(percent) {', '.destroy?.();', 'export default ResourcePreview;')
foreach ($t in $once) {
  $n = ([regex]::Matches($s, [regex]::Escape($t))).Count
  if ($n -lt 1) { "MISSING: $t" } else { "ok {0}x  {1}" -f $n, ($t -replace '\s+',' ') }
}
"done"
