@echo off
cd /d "%~dp0"
title GitHub Login and Push - WookyungHub

echo ========================================================
echo  GitHub Login for wookyung.hub@gmail.com
echo ========================================================
echo.
echo Connecting to GitHub...
echo A browser window may open asking you to sign in to GitHub.
echo Please sign in with: wookyung.hub@gmail.com
echo.

git push -u origin main

echo.
if errorlevel 1 (
    echo [ERROR] Push failed. Please check the error message above.
) else (
    echo [SUCCESS] Successfully uploaded to GitHub!
    echo Now you can go back to Cloudflare and click [Retry deployment].
)
echo.
pause
