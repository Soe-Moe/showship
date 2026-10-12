## What this changes

<!-- What it does for a user, not only which files moved. Link the issue it closes, if any. -->

## Checks I ran

- [ ] `lint_report.js` and `build_deck.js` on `skill/examples/report.example.json`
- [ ] Template or style change: built the example in every style, ran `check_deck.js --png` on each and looked at the slides, including a long-text case
- [ ] `report.json` fields changed: updated `build_deck.js`, `references/templates.md`, `references/report.schema.json` and the example together
- [ ] Installer change: ran `node bin/install.js --yes --dir /tmp/skills-test --skip-deps`
- [ ] Not needed for this change (say why):

## Also check

- [ ] No real `config.json`, generated `.pptx`, tokens or customer data in the diff
- [ ] No invented statistics, customers or quotes in examples or docs
- [ ] If installer flags, config keys, slide fields, character limits or design names changed, I listed them below so the website can be updated

<!-- Changes the website needs: -->
