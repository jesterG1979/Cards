# Card Price

A phone-friendly web app for checking what a Pokémon card is worth in
Australian dollars. Open the camera, fit the card in the box, and the app
shows the card, the set, the number, the rarity, and market prices in AUD.
If the scan is wrong, pick another match or search by name. Cards you add
stay in a list on this phone, with a running total.

## How scanning works

The photo stays on the server only long enough to read it. Nothing about
the photo is stored.

1. The app looks for the card in the frame, then reads the writing with
   Tesseract (the `tesseract` program on the computer running the app).
2. It looks for the collector number at the bottom, such as `025/165`.
   That number is the card number and the set's printed total.
3. It asks the [Pokémon TCG API](https://pokemontcg.io) for cards with
   that name and number.
4. If several cards are still possible, it compares your photo with the
   official card picture and puts the closest one first.
5. You confirm the card, or pick a different one, before it is added to
   My cards.

Full-art cards with writing over the picture are harder to read. Search by
name when a scan comes back empty.

Prices come from TCGplayer (US dollars, market price) and Cardmarket
(euros, average selling price). They are converted with the
[Frankfurter](https://www.frankfurter.dev) rate for that day. Each price
shows its source and date. If a price or a rate is missing, the app says
**no price**. It does not fill in a guess.

## Setup

You need Node.js 22+ and Tesseract.

```bash
# Debian or Ubuntu
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract
```

```bash
npm install
```

An API key is optional. Without one, the Pokémon TCG API allows fewer
requests. To use a key, create a `.env.local` file:

```bash
POKEMONTCG_API_KEY=your-key
```

## Run

```bash
npm run dev
```

Open <http://127.0.0.1:38471> on your computer. On an iPhone, the camera
only works on `https://` or on `localhost`. For a phone on the same Wi-Fi,
deploy the app (see below) or use a tunnel that gives you an https address.

Add it to the home screen from Safari's Share menu. The installed app
opens full screen and uses the rear camera.

## Tests

```bash
npm test
```

The tests cover price conversion, missing prices, the collector-number
reader, and a live check: they download the official picture of Pikachu
from the 151 set (card `sv3pt5-25`) and a slightly rotated JPEG of that
picture, then check that the top match is that card and that the prices
are in AUD with a source and a date. That test needs the network and
Tesseract.

## Deploy

The scanner shells out to Tesseract, so the app needs a normal Node.js
server, not a short serverless function.

```bash
docker build -t card-price .
docker run --rm -p 38471:38471 -e POKEMONTCG_API_KEY=your-key card-price
```

Put the container behind HTTPS. iPhone Safari will not open the camera on
a plain `http://` site. Prices are loaded when someone scans or opens My
cards. They are not baked in at build time.
