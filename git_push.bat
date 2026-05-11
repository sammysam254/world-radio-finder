@echo off
cd /d "C:\Users\sammy\Desktop\radio\world-radio-finder"

echo === Setting git identity ===
git config --global user.email "sammyseth260@gmail.com"
git config --global user.name "sammysam254"

echo === Git status ===
git status

echo.
echo === Removing .env from tracking if it was committed ===
git rm --cached .env 2>nul

echo.
echo === Staging all changes ===
git add .gitignore
git add supabase/config.toml
git add supabase/migrations/00000000000000_full_schema.sql
git add src/integrations/supabase/client.ts

echo.
echo === Commit ===
git commit -m "migrate to own Supabase project (uwbjvhrqqknukfzzzsii)"

echo.
echo === Push to main ===
git push origin main

echo.
echo === Done ===
