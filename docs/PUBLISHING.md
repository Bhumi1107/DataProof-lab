# Publishing DataProof Lab to GitHub

## 1. Make a new repository

1. Sign in to your GitHub account and open **https://github.com/new**.
2. Choose your account as owner, repository name **DataProof-Lab**, visibility **Public**.
3. **Do not add a README or .gitignore** to the empty GitHub repo because both are included locally; this avoids conflicts during the first push.
4. Click **Create repository**.

## 2. Upload the complete project using Git

First, extract the release ZIP to an ordinary location such as `Documents/DataProof-Lab` (not a `Temp` folder). Open this folder in VS Code, then use **Terminal → New Terminal**:

```powershell
git --version
# Set these two lines only if you have not configured Git on this PC:
# git config --global user.name "Your preferred Git name"
# git config --global user.email "your-verified-github-email@example.com"

git init
git add .
git commit -m "Initial release: DataProof Lab browser quality workbench"
git branch -M main
git remote add origin https://github.com/Bhumi1107/DataProof-lab.git
git push -u origin main
```

GitHub may prompt you to sign in via your browser. **Never share a password or access token in chat.** If `origin` already exists, use `git remote -v` to inspect it rather than running `git remote add` again.

Alternative: You can upload files using the GitHub web interface, but **the ZIP must be extracted first** and you need to upload subfolders (including `.github/` and `tests/`) as well. Git is recommended because future changes and history are easier to manage.

## 3. Publish the site with GitHub Pages

1. Open `https://github.com/Bhumi1107/DataProof-lab/settings/pages`.
2. **Source:** Deploy from a branch.
3. **Branch:** `main`; **Folder:** `/(root)`; click Save.
4. Watch the repository's **Actions** tab for the Pages deployment; also look for the green **Quality checks** run.
5. After Pages says **Your site is live**, the expected URL is `https://bhumi1107.github.io/DataProof-lab/`.

The URL is only expected, **not verified**, until the repo is created and its Pages deployment succeeds.

## 4. Verify after publication

- Open the live URL in a fresh browser tab.
- Click **Try a sample dataset**, then check: 6 rows, 5 columns, 3 missing cells, 1 duplicate.
- Confirm the Cleaning Studio shows 6 → 5 rows and 90% → 92% completeness by default.
- Download the cleaned CSV and a Dataset Passport JSON file.
- Check narrow mobile width and keyboard navigation.
- Keep your GitHub commits honest: dates show when changes were recorded, not how many hours you worked.

## 5. Updating the project

Make a focused change, run `npm test`, and then:

```powershell
git add .
git commit -m "fix: describe the tested improvement"
git push
```

The `Quality checks` workflow runs for pushes to main. GitHub Pages can rebuild automatically for main branch changes once Pages is enabled.
