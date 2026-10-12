# Security Policy

## Supported versions

Showship is in beta. Only the newest release on npm (`npm view showship dist-tags`) gets security fixes. If you are on an older version, update first with `npx showship@latest --yes` and check whether the problem is still there.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Email **soemoeoo.info@gmail.com** with:

- what you found and where (file, script or installer step)
- the steps to reproduce it, and the Showship version (`VERSION` file in the installed skill folder, or `npm view showship version`)
- what an attacker could do with it

You will get a reply as soon as the maintainer can send one. Showship is maintained by one person, so there is no fixed response time. Once the problem is confirmed, a fix is released and the report is credited in the release notes, unless you prefer to stay anonymous.

Please give the maintainer reasonable time to ship a fix before you share the details publicly.

## What is in scope

Showship runs on your machine, as you, and reads your repositories and task trackers. These are the areas where a flaw would matter most:

- **Credentials.** Tracker tokens (`JIRA_API_TOKEN`, `LINEAR_API_KEY`, `ASANA_TOKEN`, `CLICKUP_TOKEN`) are read from environment variables only. Anything that writes a token into `config.json`, a report file, a deck or a log is a vulnerability.
- **Data leaving the machine.** The only network call Showship makes on its own is the update check, which sends just the package name to the npm registry. Anything that sends repository content, reports or config elsewhere is a vulnerability.
- **The installer** (`bin/install.js`). It copies files into an agent's skills folder, backs up the old install to `~/.showship/backups/`, and runs `npm install`. Path traversal, writing outside those folders or running unexpected commands is in scope.
- **The collectors and the deck builder** when they handle untrusted input, such as a commit message, a pull request comment, a task title or an image file that tries to run code or read other files.
- **The published npm package.** It should contain only what `package.json` `files` lists. A secret, a real `config.json` or an unexpected file in the package is in scope.

## What is out of scope

- Problems in a third-party service Showship talks to (GitHub, Jira, npm). Report those to the service.
- Issues that need an attacker to already control your machine or your agent's skills folder.
- The agent itself doing something you asked it to do. Review what the agent plans to run, as you would for any tool.

## Staying safe as a user

- Keep tokens in your shell environment or a secret manager, never in `config.json`.
- Look at images before they go on a slide. Do not use screenshots that show customer data, tokens or internal addresses.
- Do not commit `skill/config.json` or generated decks to a public repository.
