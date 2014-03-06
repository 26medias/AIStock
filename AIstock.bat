@echo off
cd C:\xampp\htdocs\git\AIStock
node main.js -online false -timeout 120000 -threads 1 -debug_mode true -db aistock -mongo_remote false
pause