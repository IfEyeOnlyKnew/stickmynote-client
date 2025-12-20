# Git Repository Setup Commands

This document contains all the commands used to initialize and push this repository to GitHub.

## Date
December 13, 2025

## Repository Details
- **GitHub Username:** IfEyeOnlyKnew
- **Repository Name:** stickmynote-client
- **Repository URL:** https://github.com/IfEyeOnlyKnew/stickmynote-client

## Commands Executed

### 1. Initialize Git Repository
```bash
git init
```
Initialized empty Git repository in `C:/stick-my-note-dev/stickmynote-client-install/.git/`

### 2. Stage All Files
```bash
git add .
```
Added all 840 files to staging area (with CRLF line ending warnings on Windows).

### 3. Create Initial Commit
```bash
git commit -m "Initial commit"
```
Created commit `b7fba69` with 840 files changed, 130,282 insertions(+).

### 4. Add Remote Repository
```bash
git remote add origin https://github.com/IfEyeOnlyKnew/stickmynote-client.git
```
Connected local repository to GitHub remote.

### 5. Rename Branch to Main
```bash
git branch -M main
```
Renamed default branch from `master` to `main`.

### 6. Push to GitHub
```bash
git push -u origin main
```
Pushed all code to GitHub and set upstream tracking.

## Result
Successfully pushed 1,205 objects (1.75 MiB) to GitHub repository.

## Notes
- Line ending warnings (LF → CRLF) are normal on Windows and handled by Git automatically
- The `-u` flag in the push command sets up tracking so future `git push` commands work without specifying remote/branch
- Total files committed: 840
- Total lines of code: 130,282

## Future Git Commands

### Check Status
```bash
git status
```

### Pull Latest Changes
```bash
git pull
```

### Push Changes
```bash
git add .
git commit -m "Your commit message"
git push
```

### View Commit History
```bash
git log
```

### View Remote Repository
```bash
git remote -v
```
