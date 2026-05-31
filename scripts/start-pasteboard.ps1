$ErrorActionPreference = 'Stop'

$HostName = '43.133.171.24'
$UserName = 'ubuntu'
$RemotePort = '3088'
$LocalPort = '3088'
$Password = '1072284487.wmx'
$Url = "http://127.0.0.1:$LocalPort"
$SshPass = 'C:\Users\联想\scoop\shims\sshpass.exe'
$Ssh = 'C:\Windows\System32\OpenSSH\ssh.exe'

function Test-LocalPort {
    param([string]$Port)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect('127.0.0.1', [int]$Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne(250, $false)
        if ($connected) {
            $client.EndConnect($async)
        }
        $client.Close()
        return $connected
    } catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $SshPass)) {
    throw "sshpass not found: $SshPass"
}
if (-not (Test-Path -LiteralPath $Ssh)) {
    throw "ssh not found: $Ssh"
}

if (-not (Test-LocalPort -Port $LocalPort)) {
    $arguments = @(
        '-p', $Password,
        $Ssh,
        '-N',
        '-L', "$LocalPort`:127.0.0.1`:$RemotePort",
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-o', 'StrictHostKeyChecking=no',
        "$UserName@$HostName"
    )
    Start-Process -FilePath $SshPass -ArgumentList $arguments -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Start-Process $Url
