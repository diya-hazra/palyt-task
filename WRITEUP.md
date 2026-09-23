# Write-up

## 1. The calls I made

**Deleting an ingredient a recipe needs.** Bay leaves aren't used by
anything, so deleting them is a no-op with no side effects - just remove
the row. Cashews are used by two dishes, so deleting them isn't really
"delete a row," it's "stop being able to cook two dishes." I block the
delete by default and tell the user which dishes would break. If they
confirm anyway, I remove the ingredient and strip it from those recipes,
but I mark those dishes `discontinued` rather than quietly leaving them
on the menu with a missing ingredient - a recipe that's silently wrong is
worse than a dish that's visibly off the menu until someone fixes it.

I didn't go with silent cascade-delete (removes the ingredient, recipes
just lose a line, dish stays "available") because that changes what the
dish *is* without telling anyone - Kaju Curry without cashews isn't Kaju
Curry. I also didn't go with a hard block with no override, because real
kitchens do discontinue ingredients (supplier stops carrying something)
and the tool shouldn't make that impossible, just make it visible.

**Units.** Stock is bought in kg/l, recipes are written in g/ml - the
brief's paneer example. Everything gets converted to a common base
(grams/ml, `kg`/`l` × 1000) before any comparison or deduction happens, in
one place (`toBase`/`fromBase` in `logic.js`), so there's exactly one spot
that can get the factor-of-1000 wrong instead of one per call site.

**Validation.** Blocked: empty name, duplicate name (case-insensitive),
negative quantity, negative par, unrecognised unit. Allowed on purpose:
quantity or par of exactly 0 (an ingredient can genuinely run out, and a
par of 0 is a legitimate "don't bother flagging this" setting), and
quantity < par at save time (that's the normal state right after a busy
service, not an error).

## 2. How I checked the numbers

Tests target the two things that actually determine correctness:
`isDishAvailable` (does the par comparison hold across unit conversion)
and `deductStockForOrder` (does one order remove exactly the recipe
amount, correctly converted, without mutating the input array). The test
fixtures are hand-built and deliberately separate from `data/*.json`, so
editing the real data can't accidentally make a test pass or fail for the
wrong reason.

The case I actually cared about proving: ordering *one* dish can take
*two* dishes off the menu, because cashews are shared and the stock
level starts just above par (550g vs 500g par; Kaju Curry uses 60g). One
order → 490g → below par → both Kaju Curry and Cashew Pulao disappear
from the menu in the same render. That's covered as its own test, not
just asserted by eyeballing the UI.

What would have to be wrong for the tests to still pass: if I'd hardcoded
the post-deduction number instead of deriving it (e.g. `assert
cashews.quantity === 0.49` without the conversion actually running), a
broken `toBase` could still coincidentally produce 0.49 for a different
reason. I checked this by hand: 550g − 60g = 490g = 0.49kg, matches. And
the "not mutated" assertion means a version of `deductStockForOrder` that
mutates in place and returns nothing useful would fail loudly, not
silently pass with the UI happening to look right.

## 3. Another day

- The availability rule itself, which I think is the most useful thing
  to flag: "unavailable when any ingredient is below par" conflates two
  different questions - *"should we reorder this?"* (par) and *"can we
  cook one more portion?"* (whether stock ≥ the recipe's actual
  requirement). A dish can sit just barely below par with stock for
  another fifty orders, and get pulled from the menu for no real reason.
  Worse, the reverse can also happen: if a par level is set very low, a
  dish can stay listed as available even when there's only enough stock
  left for one more portion - the system won't warn anyone until that
  last order fails. I'd want a second, independent check - "is stock ≥
  what this recipe needs" - and treat *that* as the hard unavailable
  signal, with "below par" as a separate low-stock warning for
  reordering rather than something that hides the dish from diners.
- Partial availability / substitutions aren't handled at all - a dish is
  binary available/unavailable, when a real kitchen might 86 an add-on
  rather than the whole dish.
- Write stock/recipes back to the JSON files (or localStorage) so
  edits survive a refresh - right now state only lives in memory, per
  the scope note.
- Undo on delete/order, since both are currently one click with no way
  back except re-adding stock manually.


