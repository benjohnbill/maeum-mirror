# 001 — Animate the Health permission switches

- **Status**: DONE (2026-11-23)
- **Commit**: e8db441 (working tree had uncommitted motion work in `public/phone-flow.css` and `public/styles.css`)
- **Severity**: MEDIUM
- **Category**: Missed opportunities (Feedback)
- **Estimated scope**: 1 file, 4 lines

## Problem

The phone demo copies the iOS Health access sheet. On iOS, a switch thumb slides and the track fills green.
Here, the thumb jumps and the color changes in one frame. Each user flips up to 10 of these switches in the demo,
so the jump is the one spot where the copied sheet reads as fake.

```css
/* public/phone-flow.css:98-107 — current */
.health-types input {
  appearance: none; -webkit-appearance: none; flex: none; width: 48px; height: 29px;
  position: relative; margin: 0 0 0 auto; border-radius: 20px; background: var(--switch-off); cursor: pointer;
}
.health-types input::before {
  content: ''; position: absolute; top: 2px; left: 2px; width: 25px; height: 25px;
  border-radius: 50%; background: white; box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
}
.health-types input:checked { background: #30c45b; }
.health-types input:checked::before { transform: translateX(19px); }
```

## Target

```css
.health-types input { transition: background-color 200ms ease-out; }
.health-types input::before { transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
@media (prefers-reduced-motion: reduce) {
  .health-types input::before { transition: none; }
}
```

Color still fades under reduced motion. Only the slide is dropped.

## Repo conventions to follow

- The entry curve `cubic-bezier(0.16, 1, 0.3, 1)` is already used in `public/styles.css:246` (`.blk-ink`) and `:290` (`.msg`). Reuse it. Do not add a token.
- Reduced-motion rules sit next to the rule they cover, as in `public/phone-flow.css:52`.

## Steps

1. In `public/phone-flow.css`, directly after `.health-types input:checked::before { transform: translateX(19px); }`, add the four lines from **Target**.

## Boundaries

- Do NOT edit the existing switch rules. Append only.
- Do NOT touch `.access-sheet` rules (plan 002 covers them).
- If the switch rules do not match the excerpt above, STOP and report.

## Verification

- **Mechanical**: none (plain CSS). Load `/?phone` or the phone preview page and confirm no console errors.
- **Feel check**: open the Health sheet, tap a switch on and off quickly.
  - The thumb slides; it never jumps.
  - Tapping again mid-slide reverses from where the thumb is (transitions retarget). It never restarts from the edge.
  - "모두 켜기" flips all switches together; all of them slide at once.
  - DevTools Animations panel at 10%: the thumb decelerates into place with no overshoot.
  - Rendering panel, `prefers-reduced-motion: reduce`: the thumb jumps, the green still fades.
- **Done when**: every feel check above holds in Chrome.
