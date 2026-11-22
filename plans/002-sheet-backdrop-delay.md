# 002 — Keep the connect step visible while the Health sheet rises

- **Status**: DONE (2026-11-23)
- **Commit**: e8db441 (working tree had uncommitted motion work in `public/phone-flow.css`)
- **Severity**: MEDIUM
- **Category**: Physicality & origin (a jarring change inside an existing animation)
- **Estimated scope**: 1 file, 3 lines

## Problem

The sheet now rises over 500ms. But two rules switch at the first frame of the open:
the connect step goes `visibility: hidden` and the screen background turns to the sheet color.
So the user sees the connect screen vanish, an empty screen for about half a second, and then the sheet arrive.
On iOS the screen under the sheet stays until the sheet covers it.

```css
/* public/phone-flow.css:45-54 — current */
.access-sheet {
  transform: translateY(100%); clip-path: inset(0 0 100% 0);
  transition: transform 500ms cubic-bezier(.32, .72, 0, 1), clip-path 500ms cubic-bezier(.32, .72, 0, 1),
    display 500ms allow-discrete, overlay 500ms allow-discrete;
}
.access-sheet[open] { transform: none; clip-path: inset(0); }
@starting-style { .access-sheet[open] { transform: translateY(100%); clip-path: inset(0 0 100% 0); } }
@media (prefers-reduced-motion: reduce) { .access-sheet { transition: none; } }
.phone-screen:has(.access-sheet[open]) { background: var(--sheet-surface, white); }
.phone-screen:has(.access-sheet[open]) .connect-step { visibility: hidden; }
```

Dark mode repeats the background rule at `public/phone-flow.css:111`.

## Target

Delay the two switches by the sheet's duration on open only. On close, the base rules carry no delay,
so the connect step shows at once and sits behind the sheet while it leaves.

```css
.phone-screen:has(.access-sheet[open]) { background: var(--sheet-surface, white); transition: background-color 0s 500ms; }
.phone-screen:has(.access-sheet[open]) .connect-step { visibility: hidden; transition: visibility 0s 500ms; }
@media (prefers-reduced-motion: reduce) {
  .phone-screen:has(.access-sheet[open]), .phone-screen:has(.access-sheet[open]) .connect-step { transition: none; }
}
```

The 500ms must equal the `.access-sheet` duration. If that duration changes, change both.

## Repo conventions to follow

- Reduced motion sits next to the rule it covers, as in `public/phone-flow.css:52`.

## Steps

1. Replace `public/phone-flow.css:53-54` with the first two lines of **Target**.
2. Add the reduced-motion block from **Target** directly after them.

## Boundaries

- Do NOT change the `.access-sheet` transition values.
- Do NOT touch the dark-mode block at line 111. It sets only the color; the transition from step 1 still applies.
- If lines 45-54 do not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (plain CSS). Load the phone preview and confirm no console errors.
- **Feel check**: tap "건강 앱 연결" (the button that opens `#healthSheet`).
  - DevTools Animations panel at 10%: the connect step stays visible under the rising sheet and disappears only when the sheet is fully up.
  - Close with "허용 안 함": the connect step is visible behind the sheet as it slides down.
  - Repeat in dark mode (Rendering panel, `prefers-color-scheme: dark`): no black-to-dark flash at open.
  - `prefers-reduced-motion: reduce`: the sheet and the background switch both happen at once.
- **Done when**: no frame shows an empty phone screen during open or close.
- **Uncertain**: this was judged from the code, not watched. If the 5px strip above the sheet (`fitSheet`, `public/js/phone-access.js:45`) shows the connect step through it after the sheet is up, report it; do not improvise a fix.
