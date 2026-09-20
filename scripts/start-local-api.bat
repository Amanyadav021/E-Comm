@echo off
REM ShopCraft - run the API locally and expose it via a Cloudflare quick tunnel.
REM TEMPORARY BRIDGE ONLY: the site stays up only while this PC and these two
REM windows are running, and the tunnel URL changes every restart.
REM Permanent fix = deploy apps/api to an always-on host (see docs/DEPLOYMENT.md).

echo Starting ShopCraft API...
start "ShopCraft API" cmd /k "cd /d D:\Future\E-Commerce\apps\api && node dist\main.js"

echo Waiting for the API to come up...
timeout /t 12 /nobreak >nul

echo Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "C:\Users\ACER\bin\cloudflared.exe tunnel --url http://localhost:4000 --no-autoupdate"

echo.
echo ============================================================
echo  Look in the "Cloudflare Tunnel" window for a URL like:
echo     https://something-random.trycloudflare.com
echo.
echo  That URL changes EVERY restart. After copying it you must:
echo    1. Update NEXT_PUBLIC_API_URL in BOTH Vercel projects
echo    2. Redeploy both (Next.js bakes it in at build time)
echo    3. Re-point image URLs stored in the database
echo ============================================================
echo.
pause
