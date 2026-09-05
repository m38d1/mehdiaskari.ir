---
name: weighted-progress-wf
description: Compute and explain hierarchical (parent-relative) weight factors and weighted physical progress in project controls. Use when asked about ضریب وزن, W.F, weighted progress, percent-complete roll-up, WBS weighting, estimating progress from cost only, or reconciling a Primavera P6 / MS Project summary row with its children.
---

## Formulas

```
W.F↑_i      = V_i / V_parent                    # parent-relative weight
W.F_proj    = Π W.F↑ along the path to the root  # weight against the whole project
progress_i  = C_i / V_i                          # leaf proxy, when no physical % exists
progress_p  = Σ (W.F↑_child × progress_child)    # roll-up
weighted    = Σ (W.F_proj_leaf × C_leaf / V_leaf)
```

`W` = importance weight, `V` = value/budget at completion (BAC of the activity),
`C` = actual cost to date (ACWP).

## Invariants — a model breaking any of these is wrong

1. Under every parent, `Σ W.F↑` of the children = **exactly 1**.
2. `Σ W.F_proj` over the roots = 1, and `Σ` over the leaves = the same number.
3. Bottom-up (from leaves) and top-down (roll-up) must give the same project progress.
4. Summary rows roll up from their children; a summary row's own `V`/`C` must be ignored,
   otherwise the branch is double-counted.

## The identity people miss

**If the weighting basis is `V`, weighted progress is algebraically identical to the raw cost
ratio:**

```
Σ (V_i/V) × (C_i/V_i)  ≡  Σ C_i / V
```

So choosing "weight by value" buys you nothing except a longer formula. Weighting only reveals
something when `W` deliberately differs from `V` — that is the whole point of an importance
weight. If a client says "we weight by budget", tell them their number is just spend-over-budget
under another name.

## Gotchas that bite in real projects

- **Procurement distortion.** Equipment-heavy packages consume budget long before physical work
  exists, so the cost ratio *overstates* them. Commissioning is the mirror image: it spends late
  and finishes fast, so the cost ratio *understates* it. A package at 70% spend may be at 15%
  physical.
- **Inflation and FX** move `C` without moving scope. Rebase before comparing periods.
- **Never hand-enter `W.F↑`** after re-scoping a parent's children — recompute from `V`, or the
  siblings stop summing to 1 and the roll-up silently lies.
- **Report the gap, not just the number.** The difference between weighted progress and raw cost
  progress is the finding. A large negative gap means money went out without physical work.
- Treat cost-ratio progress as a **conservative estimate** and cross-check it against at least one
  physical or milestone measure before publishing it to a client.

## Canonical implementation in this repo

- `lab/wf-engine.js` — dependency-free, loads in browser and Node.
- `tools/test-wf-engine.js` — pins the engine to the two worked examples published in
  `/blog/weight-factor-excel-msp/` (flat: `0.20/0.30/0.15/0.25/0.10` → `41%`;
  hierarchical: `W.F↑ = 0.30/0.20/0.50` → `W.F_proj = 0.18/0.12/0.30`).
- `/lab/weight-factor/` — the interactive tool; run it before writing a formula by hand.
