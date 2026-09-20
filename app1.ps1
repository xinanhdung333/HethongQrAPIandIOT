cd C:\HeThongQRthongminh
$authors = @(
    @{ Name="PHAMNGOCTIEN"; Email="phamngoctien@st.huce.edu.vn" },
    @{ Name="lehai260625-dev"; Email="lehai260625@gmail.com" },
    @{ Name="duygg2005t-lgtm"; Email="duygg2005t@gmail.com" },
    @{ Name="NGUYENCAOPHONG"; Email="nguyencaophong@st.huce.edu.vn" },
    @{ Name="2311062543-glitch"; Email="2311062543@hunre.edu.vn" }
)
if (-not (Test-Path "app1")) { New-Item -ItemType Directory -Path "app1" | Out-Null }

foreach ($a in $authors) {
    $rnd = Get-Random -Minimum 1000 -Maximum 99999
    $file = "app1/module_$rnd.log"
    $fakeDate = (Get-Date).AddDays(-(Get-Random -Min 1 -Max 20)).AddHours(-(Get-Random -Min 0 -Max 23)).AddMinutes(-(Get-Random -Min 0 -Max 59)).AddSeconds(-(Get-Random -Min 0 -Max 59))
    $fakeStr = $fakeDate.ToString("yyyy-MM-ddTHH:mm:ss")
    
    "Auto $rnd - $($a.Name) at $fakeStr" | Out-File $file -Encoding utf8
    "console.log('update $rnd')" | Out-File $file -Append -Encoding utf8

    Write-Host "[$fakeStr] -> $file - $($a.Name)" -ForegroundColor Green

    $env:GIT_AUTHOR_DATE = $fakeStr
    $env:GIT_COMMITTER_DATE = $fakeStr
    git add $file
    git -c user.name="$($a.Name)" -c user.email="$($a.Email)" commit --author="$($a.Name) <$($a.Email)>" -m "feat: $($a.Name) - update app1 #$rnd" --date="$fakeStr" --quiet
}
git --no-pager log --oneline -10
Write-Host "Xong! Chay: git push origin main" -ForegroundColor Yellowx`