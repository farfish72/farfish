@echo off
cd /d "c:\Users\PC\Desktop\farfish"

git add android-app/app/src/main/res/mipmap-mdpi/ic_launcher*.png
git add android-app/app/src/main/res/mipmap-hdpi/ic_launcher*.png
git add android-app/app/src/main/res/mipmap-xhdpi/ic_launcher*.png
git add android-app/app/src/main/res/mipmap-xxhdpi/ic_launcher*.png
git add android-app/app/src/main/res/mipmap-xxxhdpi/ic_launcher*.png
git add android-app/app/src/main/res/mipmap-anydpi-v26/*.xml
git add android-app/app/src/main/res/mipmap-anydpi-v33/*.xml
git add android-app/app/src/main/res/drawable/ic_launcher_foreground.xml
git add android-app/generate_icons.py
git add android-app/.agents/icon-fix-report.md

git commit -m "fix: Android launcher icon compatibility across API 28-35+

- Generate density-specific PNG icons for all mipmap densities
- Add missing ic_launcher_round.png for all densities
- Add ic_launcher_foreground.png as proper mipmap resources
- Add ic_launcher_monochrome.png for Android 13+ themed icons
- Update adaptive icon XMLs to use @color background and @mipmap foreground
- Create mipmap-anydpi-v33 for Android 13+ with monochrome layer
- Add generate_icons.py script for icon regeneration
- Build verified successful

Fixes icon rendering issues on various Android devices and launchers.
Supports Android 9 (API 28) through Android 16 (API 35+)."

echo.
echo Commit complete. Files staged and committed.
pause
