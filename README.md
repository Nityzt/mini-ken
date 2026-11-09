# Tiny Kendo

A cute 8-bit kendo game in the browser, made for fun. It runs on a keyboard, and all the game's art is drawn by code.

```
pnpm install
pnpm dev         # http://127.0.0.1:3210
pnpm dev:online  # the same, with the real server, accounts and lobbies
pnpm test
pnpm typecheck
pnpm build
```

Development links open a scene directly and never touch your save, for example `/?scene=duel&node=goose&dan=3&hp=30&money=100`. `/?art` shows the art sheet.

- **Design:** `docs/superpowers/specs/2026-11-05-tiny-kendo-design.md`
- **Multiplayer hosting:** `docs/multiplayer.md`
- **Kendo terms:** `docs/Glossary.pdf`
