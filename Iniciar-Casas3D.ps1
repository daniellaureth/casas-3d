[CmdletBinding()]
param([switch]$NoBrowser, [switch]$Quest, [switch]$AirLink, [ValidateRange(0,65535)][int]$Port = 0)
$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$pageFile = Join-Path $appRoot 'Casas3D.html'
$server = $null
$questAdb = $null
$questDevice = $null
$questPort = $null
try {
    if (!(Test-Path -LiteralPath $pageFile)) { throw 'Extraia todos os arquivos do ZIP antes de abrir o aplicativo.' }
    if ($Quest -and $AirLink) { throw 'Escolha apenas uma conexao: Air Link sem fio ou USB.' }
    if ($AirLink) {
        # Read the installed runtime; do not change machine-wide VR settings.
        $xrSettings = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Khronos\OpenXR\1' -ErrorAction SilentlyContinue
        $xrRuntime = $xrSettings.ActiveRuntime
        if (!$xrRuntime -or !(Test-Path -LiteralPath $xrRuntime) -or $xrRuntime -notmatch 'oculus_openxr_64\.json$') {
            throw 'No aplicativo Meta Horizon Link do notebook, abra Configuracoes > Geral > OpenXR e defina a Meta como ativa. Depois abra novamente o atalho sem fio.'
        }
        Write-Output 'CASAS 3D - AIR LINK SEM FIO'
        Write-Output 'Conecte o Air Link nos oculos. Na area de trabalho do notebook, clique em Entrar na casa sem fio.'
        Write-Output 'Mantenha esta janela aberta durante o passeio. Feche-a para encerrar.'
    }
    if ($Quest) {
        $NoBrowser = $true
        if ($Port -eq 0) { $Port = 8765 }
        $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
        $adbCandidates = @(
            $(if ($adbCommand) { $adbCommand.Source }),
            (Join-Path $appRoot 'platform-tools\adb.exe'),
            (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe')
        )
        $questAdb = $adbCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
        if (!$questAdb) { throw 'Android Platform Tools nao encontrado. Veja LEIA-ME-QUEST.txt. Extraia platform-tools nesta pasta ou adicione adb ao PATH.' }
        $devicesOutput = & $questAdb devices
        $devices = @($devicesOutput | Where-Object { $_ -match '^\S+\s+device$' } | ForEach-Object { ($_ -split '\s+')[0] })
        if ($devices.Count -ne 1) { throw 'Conecte somente um Quest por USB, ative o modo desenvolvedor e autorize a depuracao USB no headset. Veja LEIA-ME-QUEST.txt.' }
        $questDevice = $devices[0]
    }
    $pageBytes = [System.IO.File]::ReadAllBytes($pageFile)
    $server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $server.Start()
    $address = 'http://127.0.0.1:' + $server.LocalEndpoint.Port + '/'
    if ($AirLink) { $address += '?connection=airlink' }
    if ($Quest) {
        $questPort = $server.LocalEndpoint.Port
        & $questAdb -s $questDevice reverse "tcp:$questPort" "tcp:$questPort"
        if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel conectar a porta local ao Quest por USB.' }
        $questAddress = "http://localhost:$questPort/"
        & $questAdb -s $questDevice shell am start -a android.intent.action.VIEW -d $questAddress | Out-Null
        Write-Output "No Meta Quest Browser, abra $questAddress e selecione Entrar em VR."
        Write-Output 'Mantenha esta janela e o cabo USB conectados durante o passeio.'
    }
    $browserProcess = $null
    if (!$NoBrowser) {
        $candidates = @(
            (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
        )
        if ($AirLink) {
            # A separate Chrome profile ensures the OpenXR setting applies even
            # when the ordinary presentation or a personal browser is open.
            $candidates = @(
                (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
                (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
                (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
                (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
            )
        }
        $browserPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (!$browserPath) { throw 'Instale Microsoft Edge ou Google Chrome para abrir a apresentação.' }
        $profilePath = Join-Path $appRoot 'Perfil'
        if ($AirLink) { $profilePath = Join-Path $appRoot 'Perfil-Quest-AirLink' }
        $arguments = @('--app=' + $address, '--user-data-dir="' + $profilePath + '"', '--no-first-run', '--no-default-browser-check', '--window-size=1440,900')
        if ($AirLink) { $arguments += @('--force-webxr-runtime=openxr', '--force_high_performance_gpu') }
        # This is the visible application requested by the user. Browser sandboxing stays enabled.
        $browserProcess = Start-Process -FilePath $browserPath -ArgumentList $arguments -PassThru
    }
    Write-Output $address
    $lastRequest = Get-Date
    while ($true) {
        if (!$server.Pending()) {
            if (!$AirLink -and $browserProcess -and $browserProcess.HasExited -and ((Get-Date) - $lastRequest).TotalSeconds -gt 15) { break }
            Start-Sleep -Milliseconds 100
            continue
        }
        $client = $server.AcceptTcpClient()
        $client.LingerState = [System.Net.Sockets.LingerOption]::new($true, 5)
        $stream = $null
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 3000
            $stream.WriteTimeout = 15000
            $buffer = New-Object byte[] 8192
            $request = ''
            # TCP may split a browser request into several packets. Consume the
            # complete header before closing the connection after the response.
            while (!$request.Contains("`r`n`r`n") -and $request.Length -lt 16384) {
                $count = $stream.Read($buffer, 0, $buffer.Length)
                if ($count -eq 0) { break }
                $request += [System.Text.Encoding]::ASCII.GetString($buffer, 0, $count)
            }
            $firstLine = ($request -split "`r`n")[0]
            Write-Verbose "Request: $firstLine"
            if ($firstLine -match '^GET /(?:\?[^ ]*)? HTTP/') {
                $header = "HTTP/1.1 200 OK`r`nContent-Type: text/html; charset=utf-8`r`nContent-Length: $($pageBytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                for ($offset = 0; $offset -lt $pageBytes.Length; $offset += 65536) {
                    $stream.Write($pageBytes, $offset, [Math]::Min(65536, $pageBytes.Length - $offset))
                }
                Write-Verbose "Sent $($pageBytes.Length) bytes"
            } else {
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 204 No Content`r`nConnection: close`r`n`r`n")
                $stream.Write($headerBytes, 0, $headerBytes.Length)
            }
            $stream.Flush()
            $client.Client.Shutdown([System.Net.Sockets.SocketShutdown]::Send)
            # Finish the TCP half-close before disposing the socket. Otherwise
            # Windows can discard the final packet of a large inline HTML page.
            while ($stream.Read($buffer, 0, $buffer.Length) -gt 0) { }
            $lastRequest = Get-Date
        } catch { Write-Verbose $_.Exception.Message } finally {
            if ($stream) { $stream.Dispose() }
            $client.Close()
        }
    }
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Casas 3D') | Out-Null
} finally {
    if ($server) { $server.Stop() }
    if ($questAdb -and $questDevice -and $questPort) { & $questAdb -s $questDevice reverse --remove "tcp:$questPort" | Out-Null }
}
