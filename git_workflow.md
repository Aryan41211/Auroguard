# AEROVIGIL — Git Workflow

## Branch policy

Use the `main` branch by default.

Do not create feature branches unless explicitly required.

## Commit strategy

Commit after each meaningful file creation or modification.

Use Conventional Commits.

Examples:

```text
docs: add master project blueprint
docs: define scenario engine
feat: add scenario generator
feat: add detection interaction
feat: add scoring engine
feat: add after action review
test: add scenario generator tests
fix: correct response timing calculation
refactor: separate scoring from API routes
```

## Commit quality

A commit should be:

- small
- understandable
- runnable where practical
- focused on one logical change

## Suggested workflow

```bash
git status
git add <files>
git commit -m "docs: add master project blueprint"
git push origin main
```

Before pushing:

```bash
git status
```

Do not commit:

- `.venv`
- Unity Library cache
- build artifacts
- secrets
- API keys
- local databases if they contain private data

## `.gitignore`

Include at minimum:

```text
.venv/
__pycache__/
.env
*.db
UnityProject/Library/
UnityProject/Temp/
UnityProject/Logs/
UnityProject/UserSettings/
node_modules/
dist/
```
