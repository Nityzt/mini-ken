# Multiplayer character, rank and sides

Issue #5: give every online player a separate, persistent appearance; preserve it over the relay and render the same fighters on both screens. Derive unlocks from the online record, with Bronze as the default; keep story progress separate. Initial side comes from the server's existing randomized match order, then the visible sides rotate after each point without changing lockstep fighter identities.

1. Model and validate a bounded appearance (character, armor palette, insignia), rank thresholds and persistence. Provide a selection/editor flow on the multiplayer route, including invite and no-story paths.
2. Exchange validated appearance in the lobby handshake and match. Validate the palette against the account record on the server; reject malformed protocol data and bump its version. Render both players' exact selections and an always-visible local-player indicator, including when looks match.
3. Apply a shared display orientation based on point parity. Invert local directional controls with the view and keep both clients' simulation state and hashes identical. Check the return-to-line, follow-through, crossed, HUD, effects and rematch cases.
4. Add tests for persistence, rank boundaries, protocol and relay validation, matching appearances and both sides' controls. Update the game design. Run the full suite and typecheck, and test with two real browser clients before opening a PR.
