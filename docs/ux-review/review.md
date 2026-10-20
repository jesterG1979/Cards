# Card Price: UX review (advice only, no code changed)
Live app: https://cards.120blackwood.com (behind Cloudflare Access). Source reviewed: /workspace/cards-deploy-v2. Screenshots captured 16 Oct 2026 at 390×844 (mobile) and 1280×800 (desktop).

**What the app is:** a mobile web app (PWA) for Pokémon cards only. You photograph a card or search for it, the server reads it with Tesseract OCR and the pokemontcg.io API, and the app shows TCGplayer (USD) and Cardmarket (EUR) prices converted to AUD. It keeps a list of cards with a running total in localStorage.
**Likely users:** Australian parents and kids sorting a binder, casual collectors checking a find, and people at a market stall or in a shop deciding whether to buy. What they need, in order: "what is it", then "what's it worth in A$", then "keep it". They are often one-handed, in poor light, and checking many cards in a row.

The app is already calm, honest (it says "no price" instead of guessing, and every price shows its source and date) and uses big tap targets. Most fixes below make it *shorter*, not bigger.

## Top 5 changes
1. **Put the price above the fold on the result screen** (mock-1). At 390×844 the full-size card image takes up the first screen, and the A$ figure starts at the very bottom edge (mobile-04b-result-fold.png). Show a small thumbnail with the name and set, then **one** headline price. Move the second source behind a disclosure.
2. **One headline number, not two.** Charizard shows A$1,381 (TCGplayer) and A$2,483 (Cardmarket) with equal weight. A casual user can't tell which one is "the value". Lead with one (TCGplayer market, which is also what the collection already uses) and show the other as secondary.
3. **Edition/variant is the biggest accuracy risk.** The sample card is a 1st Edition Base Charizard, but the price shown is the generic "Holofoil" one. 1st Ed vs Unlimited vs Shadowless can differ 5–20×. Offer the variants as a one-tap segmented control right under the price (mock-1). If the data source doesn't have them, show a note like "Edition not checked: 1st Edition cards can be worth much more".
4. **Cut the in-between Scan page; go straight to the camera, then keep scanning** (mock-2). Today the flow is Home → Scan page (two buttons and an explanation) → camera → manual "Snap" → result → "Scan again" → the Scan page *again*. Instead, Home "Scan" should open the camera. Auto-capture when the frame is steady, and after "Add", go back to the camera with a small tray showing what was just added. Batch checking is the main job of every competitor.
5. **Make the home screen about the collection value, with search built in** (mock-3). Remove the separate "Search by name" page step and the three equal-weight buttons. Show the A$ total as the hero, a large Scan button, a search field right on Home (it also takes set numbers like "25/165"), and recent scans.

## Detailed issues
| # | Sev | Screen | Issue | Recommendation |
|---|---|---|---|---|
| 1 | High | Result | Price below the fold; the 280px card image comes first | Thumbnail ~90px, price card first (mock-1) |
| 2 | High | Result | Two equal prices, no "headline" | One primary price, other in a disclosure |
| 3 | High | Result | No edition (1st Ed/Shadowless/Reverse) and no condition or grading context; prices imply near-mint raw | Variant chips. Add a "near-mint, ungraded" label on the price. Graded prices: skip for now |
| 4 | High | Search | Several result thumbnails rendered as broken images on desktop (desktop-06-search.png) | Use a placeholder card back and lazy-load fallback |
| 5 | Med | Search | Results list has no prices, so you must tap each one to compare | Show the A$ headline price on each row |
| 6 | Med | Scan | Extra start screen; manual shutter; "Scan again" goes back to the start screen and not the camera | Camera-first, auto-capture, continuous loop |
| 7 | Med | Reading | "Reading the card…" text only, no photo preview, no progress, no cancel | Show the captured frame dimmed with a spinner, plus Cancel |
| 8 | Med | Result | "I'm not sure. Pick the right card." uses a horizontal strip whose overflow isn't visible | Use "Not it? See N others" as a bottom sheet, or show the count |
| 9 | Med | Collection | Remove happens straight away with no undo; no sort or search; number shows "4" instead of "4/102" (inconsistent with the result screen) | Undo toast; sort by value; use one collector-number format everywhere |
| 10 | Med | Collection | No backup or export. Clearing Safari data loses everything, and the copy "stays on this phone" sounds reassuring but is a risk | Offer a CSV export/import (cheap) before any accounts |
| 11 | Low | Error page | "That page broke." has only "Try again", with no way Home | Add a Home link and friendlier copy |
| 12 | Low | Camera | Guide text sits at the top, far from the thumb; no torch toggle for dim rooms | Move the hint near the frame; add a torch button where supported |
| 13 | Low | Copy | Home footer paragraph repeats the README; "I couldn't match that photo" mixes first person and app voice | Shorten to one line with a "How this works" link; pick one voice |
| 14 | Low | A11y | Variant price cards are buttons wrapping big text blocks (screen readers read everything); candidate images have empty alt text; Home link has no back arrow | Use a radio group for variants; candidate alt = name and set |
| 15 | Low | Desktop | Phone-width column on a beige backdrop is fine for a phone-first app | Keep. Don't invest in desktop |

## Competitor features
| Feature | Seen in | Verdict |
|---|---|---|
| Camera-first, auto-capture, bulk/continuous scan | Collectr, TCGplayer, Dragon Shield, Ludex | **Include** (top 5 #4) |
| Edition/variant selector (1st Ed, reverse holo) | TCGplayer, Collectr, PriceCharting | **Include** |
| Portfolio value hero + daily change | Collectr, Ludex | **Include** the value; the daily change can wait (needs price history) |
| Price history chart | Collectr, PriceCharting, CardMavin | Skip for now (adds weight; shows dates instead) |
| Graded (PSA/BGS) prices | Collectr, PriceCharting, Ludex | Skip. Casual users have raw cards |
| Condition selector (NM/LP/MP) | TCGplayer, Dragon Shield | Maybe: a single "condition: near mint" label is enough now |
| Local AUD prices (eBay AU sold listings) | CardMavin (eBay sold), none AU-native | Investigate. This is the real AU edge if a source exists. Converted US prices understate AU shipping/GST |
| Sets/binder completion tracking | Collectr, Dragon Shield | Skip. Scope creep |
| Multi-game (MTG, Yu-Gi-Oh, sports) | Ludex, Collectr, TCGplayer | Skip. Pokémon-only keeps it simple |
| Buy/sell marketplace links | TCGplayer, Collectr | Skip (maybe a quiet "see listings" link later) |
| Accounts and cloud sync | All major apps | Skip. Offer CSV export instead |
| Search by set number ("25/165") | TCGplayer, PriceCharting | **Include**. It's cheap and the OCR already parses it |
| Recent scans history | Collectr, Dragon Shield | **Include** (lightweight, local) |

## Open trade-offs for Jesse
1. **Which price is "the" price?** TCGplayer market (US, fresher) or Cardmarket (EU, sometimes months old), or an average? Showing one is simpler but hides how much prices vary.
2. **Continuous scanning vs a confirm step:** auto-add after a confident match (fast, like Collectr) or always confirm (safer, as now)?
3. **Keep data on the phone only, or add a CSV export / optional sync?** Privacy and simplicity vs the risk of losing the list.
4. **Edition accuracy:** if the API can't tell 1st Edition apart, do we show a warning, ask the user, or hide prices for vintage holos?

## Files
- Current screenshots: mobile-0[1-7]*.png, desktop-0[1-7]*.png
- Mocks: mock-1-price-first.png, mock-2-camera-first.png, mock-3-home.png (HTML sources in mocks/)

## Jesse's decisions (16 Oct 2026)
1. Main price: TCGplayer, with Cardmarket shown smaller underneath.
2. Adding cards: always confirm before adding to My cards (no auto-add).
3. Backup: keep My cards on the phone and add a CSV export (no sync, no accounts).
4. Edition ambiguity: ask the user to pick the edition with a one-tap choice.
