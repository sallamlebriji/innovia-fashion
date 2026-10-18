$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localDir = Join-Path $projectRoot '.local'
$dataDir = Join-Path $localDir 'mysql-data'
$serverPath = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe'
$clientPath = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
if (-not (Test-Path -LiteralPath $serverPath)) { throw 'MySQL 8.4 was not found. Use docker compose or configure DATABASE_URL for an existing MySQL server.' }
New-Item -ItemType Directory -Path $localDir -Force | Out-Null
$configPath = Join-Path $localDir 'mysql.ini'
if (-not (Test-Path -LiteralPath $configPath)) {
  $config = "[mysqld]`nbasedir=C:/Program Files/MySQL/MySQL Server 8.4`ndatadir=$($dataDir.Replace('\','/'))`nport=3308`nbind-address=127.0.0.1`nmysqlx=OFF`nlog-error=$($localDir.Replace('\','/'))/mysql-error.log`n"
  Set-Content -LiteralPath $configPath -Value $config
}
if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'mysql'))) {
  & $serverPath "--defaults-file=$configPath" --initialize-insecure
  if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed. Inspect .local/mysql-error.log.' }
}
$listener = [Net.Sockets.TcpClient]::new()
try { $listener.Connect('127.0.0.1',3308); $running = $true } catch { $running = $false } finally { $listener.Dispose() }
if (-not $running) {
  $process = Start-Process -FilePath $serverPath -ArgumentList "`"--defaults-file=$configPath`"" -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath (Join-Path $localDir 'mysql.pid') -Value $process.Id
  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    $probe = [Net.Sockets.TcpClient]::new()
    try { $probe.Connect('127.0.0.1',3308); $ready = $true } catch {} finally { $probe.Dispose() }
    if ($ready) { break }
  }
  if (-not $ready) { throw 'MySQL did not become ready. Inspect .local/mysql-error.log.' }
}
$envPath = Join-Path $projectRoot '.env'
$rootConfigPath = Join-Path $localDir 'mysql-root.cnf'
[string[]]$rootArgs = if (Test-Path -LiteralPath $rootConfigPath) { @("--defaults-file=$rootConfigPath") } else { @('--no-defaults','--host=127.0.0.1','--port=3308','--user=root') }
$actualDataDir = (& $clientPath @rootArgs --batch --raw --skip-column-names '--execute=SELECT @@datadir').Trim()
if ($LASTEXITCODE -ne 0 -or -not $actualDataDir) { throw 'Could not verify the local MySQL data directory.' }
$actualResolved = [IO.Path]::GetFullPath($actualDataDir).TrimEnd([char[]]'\/')
$expectedResolved = [IO.Path]::GetFullPath($dataDir).TrimEnd([char[]]'\/')
if ($actualResolved -ne $expectedResolved) { throw 'Port 3308 does not point at this project database. Refusing provisioning.' }
if (-not (Test-Path -LiteralPath $envPath)) {
  $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  $demoPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(10))
  $adminPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
  $sql = "CREATE DATABASE IF NOT EXISTS innovia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE DATABASE IF NOT EXISTS innovia_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'innovia'@'127.0.0.1' IDENTIFIED BY '$password'; GRANT ALL ON innovia.* TO 'innovia'@'127.0.0.1'; GRANT ALL ON innovia_test.* TO 'innovia'@'127.0.0.1'; FLUSH PRIVILEGES;"
  $sql | & $clientPath @rootArgs
  if ($LASTEXITCODE -ne 0) { throw 'Local database provisioning failed.' }
  $config = "NODE_ENV=development`nPORT=4001`nDATABASE_URL=mysql://innovia:$password@127.0.0.1:3308/innovia`nTEST_DATABASE_URL=mysql://innovia:$password@127.0.0.1:3308/innovia_test`nADMIN_ORIGIN=http://localhost:5174`nSTOREFRONT_ORIGIN=http://localhost:3000`nSTOREFRONT_API_URL=http://127.0.0.1:4001`nDEMO_PASSWORD=$demoPassword`nBOOTSTRAP_ADMIN_EMAIL=operator@innovia.local`nBOOTSTRAP_ADMIN_PASSWORD=$adminPassword`n"
  Set-Content -LiteralPath $envPath -Value $config
}
if (-not (Test-Path -LiteralPath $rootConfigPath)) {
  $rootPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  "ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';" | & $clientPath @rootArgs
  if ($LASTEXITCODE -ne 0) { throw 'Could not secure the local root account.' }
  Set-Content -LiteralPath $rootConfigPath -Value "[client]`nhost=127.0.0.1`nport=3308`nuser=root`npassword=$rootPassword`n"
}
Write-Output 'Project MySQL is ready at 127.0.0.1:3308. Credentials were saved in the ignored .env file.'


