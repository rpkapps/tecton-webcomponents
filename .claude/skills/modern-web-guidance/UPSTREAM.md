# Upstream

Vendored from [googlechrome/modern-web-guidance](https://github.com/googlechrome/modern-web-guidance)
(`skills/modern-web-guidance/`), release v0.0.190, commit `22ab18dfb50a5d7e3bdcf471c14076a5534eae4e`.
Apache License 2.0 (`LICENSE`). Files are unmodified.

`SKILL.md` searches and retrieves guides with `npx -y modern-web-guidance@latest` (network access);
`guides/` is the same content for reading offline (`guides/<category>/<id>.md`).

To update, replace this directory with the upstream one and keep `LICENSE` and this file:

```sh
git clone --depth 1 https://github.com/googlechrome/modern-web-guidance /tmp/mwg
rm -rf .claude/skills/modern-web-guidance/{SKILL.md,guides}
cp -r /tmp/mwg/skills/modern-web-guidance/{SKILL.md,guides} .claude/skills/modern-web-guidance/
cp /tmp/mwg/LICENSE .claude/skills/modern-web-guidance/LICENSE
```
