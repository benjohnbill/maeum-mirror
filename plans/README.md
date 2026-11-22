# Animation plans

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Animate the Health permission switches | MEDIUM | DONE |
| 002 | Keep the connect step visible while the Health sheet rises | MEDIUM | DONE |

Order: 001, then 002. Both edit only `public/phone-flow.css` and do not depend on each other.
Run them after the uncommitted motion work in `public/phone-flow.css` and `public/styles.css` is committed.

Not planned (decided 2026-11-23):
- Phone step entrance (`.phone-step` with `@starting-style`): covers only signup to connect, one change per demo.
- Hero preview value slide (`public/js/app.js:101`): needs the card updated in place instead of `replaceChildren`; the landing JS is being changed in another session.
