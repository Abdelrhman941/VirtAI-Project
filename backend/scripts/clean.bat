@echo off
:: Compatibility wrapper for clean.py
python "%~dp0clean.py" %*

:: Direct fallback cleanup of cache folders
for /d /r "%~dp0.." %%d in (__pycache__ .pytest_cache) do @if exist "%%d" rd /s /q "%%d" 2>nul
