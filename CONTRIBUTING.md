# Contributing to Showship

Issues and pull requests are welcome. Useful contributions include new slide templates, collectors for other task trackers (Trello, GitHub Projects, Notion, Monday), better jargon rules, more languages, and reports from Codex and Antigravity users.

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). The same guide, with more detail, is on the website: <https://showship.github.io/docs/contributing/>.

## Before you start

- For a bug, open an issue with what you ran, what you expected and what happened. Say which agent you use (Claude Code, Codex or Antigravity) and your Node version.
- For a larger change (a new slide type, a new tracker, a change to the `report.json` fields), open an issue first so we can agree on the shape before you spend time on it.
- Small fixes (typos, wording, a jargon rule) can go straight to a pull request.

## Set up

Showship is plain Node.js (CommonJS). There is no build step, no test suite and no linter.

```bash
git clone https://github.com/Soe-Moe/showship.git
cd showship/skill/scripts && npm install
```

Try the installer without touching your real agent folders:

```bash
node bin/install.js --yes --dir /tmp/skills-test --skip-deps
```

## Check your change

Run the checks that match what you changed, and say in the pull request which ones you ran.

| You changed | Run |
| --- | --- |
| Anything in `skill/scripts/` | `node lint_report.js ../examples/report.example.json` and `node build_deck.js ../examples/report.example.json /tmp/out.pptx` from `skill/scripts` |
| A slide template or a style | Build the example report in **every** style, run `check_deck.js <deck>.pptx --png` on each, and look at the PNGs in the `-qa/` folder. Add a case with every label at its character limit. A template that only works with short example text is not finished. Then refresh the previews with `node skill/scripts/make_previews.js`. |
| `report.json` fields | Change all three sources of truth together: the template in `build_deck.js`, the field docs and limits in `skill/references/templates.md`, and `skill/references/report.schema.json`. Update `skill/examples/report.example.json` too. |
| Jargon or plain-language rules | `lint_report.js` on the example report, and check your new rule does not flag the example deck's official phase names. |
| A task tracker | Add a file in `skill/scripts/tasks/` that returns the rows described in `tasks/common.js`, and register it in `collect_tasks.js`. Credentials come from environment variables only, never from config. |
| The installer | The `--dir /tmp/skills-test` run above. |

Read [`skill/references/design_rules.md`](skill/references/design_rules.md) before touching any template. The main rules: text never relies on `fit: "shrink"`, nothing is under 11 pt, and the render check is mandatory. Edit the template code, never the generated `.pptx`.

CI builds and lints the example report in every style and smoke-tests the installer on each pull request. It cannot run the render check, because that needs LibreOffice and fonts, so that step stays yours.

## What not to commit

- A real `skill/config.json`. It holds personal settings and is git-ignored.
- Generated decks (`*.pptx`). The only tracked ones are the eight `docs/example-deck*.pptx`, one per style, and they are refreshed by `make_previews.js`.
- `node_modules`.
- Real customer data, names, tokens or internal addresses in examples or screenshots.

## Pull requests

- Keep each pull request to one change, and describe what it does for a user, not only which files moved.
- Use plain words in slide text and docs, and keep the examples free of invented statistics, customers or quotes.
- If you change installer flags, config keys, slide fields, character limits or design names, say so in the pull request. The website restates those, and the maintainer updates it to match.
- You do not need to bump the version. Releases are made by the maintainer.

## Security

Do not report a security problem in a public issue. Follow the [Security Policy](SECURITY.md).

## License

By contributing you agree that your work is released under the [MIT license](LICENSE).
