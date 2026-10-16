# UX design note

Locked decisions in `docs/ux-review/review.md` stay as written.
This note is the shape the screens build against.

## Price

`priceBoard` in `lib/prices.ts` is the only place that decides
what a result shows. Each printing has a TCGplayer headline and
a smaller Cardmarket line. Two or more edition families
(1st, Unlimited, Shadowless) start with nothing selected, so
the price waits for one tap. Holo versus reverse still defaults
to the existing preferred printing and uses the same radio group.
A card released before 2003 with no edition data shows
"Edition not checked. 1st Edition cards can be worth much more."
The app does not invent a Shadowless or 1st Edition price.
The amount saved to My cards is still `collectionQuote`, so a
Cardmarket average is never stored as a 1st Edition price.

## Search and home

`buildSearchQuery` keeps the name lookup used by scan.
A slash number such as `25/165` is parsed first and becomes a
number query plus `set.printedTotal` or `set.total`.
Home owns the field, the value, and recent scans.
`/search` redirects to `/?q=`.

## Scan

The scanner is `camera`, `reading`, `confirm`, or `blocked`.
There is no start screen. `frameSteady` takes the photo only
after the frame moves and then holds still, so returning to the
camera does not immediately shoot again. The user still taps Add.
After that, the camera comes back with a tray of cards added in
this visit. Cancel aborts the read and shows the captured frame
while it runs.

## My cards

The list stays in `cardprice.collection.v1`. Refresh stores
`printedTotal` next to the raw number, and `displayNumber` is
what every row shows, so `4/102` survives a price refresh.
`removeItem` returns the row so the screen can put it back.
`collectionToCsv` is the export. Recent scans are a second
localStorage key, capped at 8, written when a result is shown.

## Pictures

Card art uses a plain image. If the URL is missing or the request
fails, the card back is shown. That avoids the optimizer URL,
which the service worker can replace with the cached home page.

## Left out

No accounts, sync, price history, graded prices, set checklists,
or other games. No CSV import. No Cloudflare or deploy changes.
