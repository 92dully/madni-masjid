# Madni Masjid — Website

A simple, single-page static website for Madni Masjid in Langside Road, Glasgow.

Built with plain HTML, CSS, and JavaScript. Tailwind CSS is loaded from a CDN, and jsPDF is loaded from a CDN for the monthly PDF download. Daily prayer times are read from a separate `prayer-times.js` data file. There is no build step, no framework, and no backend.

---

## Files

```
Madni Masjid/
├── mmSource/                        Site source (deploy this folder)
│   ├── index.html                   Page content and structure
│   ├── style.css                    Custom styles on top of Tailwind
│   ├── script.js                    Navbar, menu, prayer times, PDF, carousel
│   ├── prayer-times.js              Daily prayer times — generated file
│   ├── favicon.svg                  Browser-tab icon (emerald crescent + star)
│   └── photos/                      Carousel images (drop new photos here)
│       └── Madni Mssjid.JPG         Interior photo (carousel slide 1)
├── GCM Prayer Times.xlsx            Source spreadsheet for begin times
├── jammat Times image.jpg           Source image of the 2026 jamaat rules
├── _build_data.py                   Python helper that generates prayer-times.js
└── README.md                        This guide
```

`mmSource/` contains everything the deployed site needs. The Excel file, the jamaat image, and `_build_data.py` live alongside it because they're only used when regenerating the prayer-times data.

---

## How to view the site locally

Double-click `mmSource/index.html` — `prayer-times.js` loads via a regular `<script>` tag, so the page works even when opened directly from the file system.

For auto-refresh while editing, install [VS Code](https://code.visualstudio.com), open the folder, install the **Live Server** extension by Ritwick Dey, then right-click `mmSource/index.html` → **Open with Live Server**.

---

## Sections on the page

1. **Hero** — masjid name and a quick link to prayer times
2. **About** — short description, the live audio link, and a photo carousel
3. **Prayer Times** — today's times in a card with a live "Next prayer in 1h 23m" countdown, plus a collapsible monthly timetable with a "Download PDF" button
4. **Learning** — Hifz & Nazara class schedule and the waiting list notice
5. **Donations** — bank transfer details (Bank of Scotland)
6. **Contact** — address, email, opening notice, and an embedded Google Map

The navigation bar links to each section. Dark mode is automatic based on the visitor's system preference.

---

## The prayer-times data

### Where the data lives
`prayer-times.js` exposes a single global variable:

```js
window.PRAYER_TIMES_DATA = [
  {
    "date": "2026-05-16",
    "day": "Saturday",
    "fajr_begin": "01:25",
    "fajr_jamaat": "01:35",
    "sunrise": "05:00",
    "zohar_begin": "13:19",
    "zohar_jamaat": "14:00",
    "asr_begin": "18:42",
    "asr_jamaat": "19:15",
    "maghrib_begin": "21:32",
    "maghrib_jamaat": "21:32",
    "isha_begin": "22:31",
    "isha_jamaat": "23:00"
  },
  ...
];
```

It's plain JavaScript wrapping an array of day objects — you can edit it by hand in any text editor.

### Where each field comes from
- **Begin times** (`fajr_begin`, `zohar_begin`, `asr_begin`, `maghrib_begin`, `isha_begin`) and **Sunrise** come from `GCM Prayer Times.xlsx`.
- **Asr** uses the **Hanafi** calculation. The spreadsheet contains both Asr I (earlier) and Asr II (Hanafi); the website uses Asr II.
- **Jamaat times** (`fajr_jamaat`, `zohar_jamaat`, `asr_jamaat`, `isha_jamaat`) come from the **2026 jamaat image** — the rules in that image are encoded in `_build_data.py` and applied to each day of the year.
- **Maghrib jamaat** is set equal to the Maghrib begin time.
- During the Ramadan periods shown on the jamaat image, the jamaat values are left as `null`. The monthly table shows these days with `—`.

### Special override
The 2026 image shows Fajr Jamaat at 01:50 from 04 May, but the masjid has confirmed that Fajr Jamaat is **01:35 until 9 August**. This override is encoded in `_build_data.py` under `FAJR_RULES`.

---

## Updating the timetable

### When a new Excel timetable is provided
1. Replace `GCM Prayer Times.xlsx` with the new file. Keep the same column layout: `Date | Day | Fajr Begins | Fajr Jamaat | Sunrise | Zohar Begins | Zohar Jamaat | Asr Begins (I) | Asr Begins (II) | Asr Jamaat | Maghrib Begins | Maghrib Jamaat | Isha Begins | Isha Jamaat`.
2. Regenerate the data file:
   ```
   python _build_data.py
   ```
   (Requires Python and `openpyxl` — `pip install openpyxl`. Run this from the folder containing `_build_data.py`.)
3. Refresh the browser.

### When the jamaat rules change
The jamaat rules are encoded in `_build_data.py` near the top — four lists named `FAJR_RULES`, `ZOHAR_RULES`, `ASR_RULES`, `ISHA_RULES`. Each entry is `("MM-DD", "HH:MM")` meaning "from this date onwards, the jamaat is at this time". A value of `None` means "Refer to Ramadan timetable" (those days appear as `—` on the site).

After editing the rules, re-run `python _build_data.py` to regenerate `prayer-times.js`.

### Editing a single day by hand
Open `mmSource/prayer-times.js` in a text editor, find the date you want to change, and edit the relevant value. Times must stay in `HH:MM` 24-hour format.

---

## Monthly timetable PDF download

The Prayer Times section has a collapsed "Monthly timetable" panel. Open it to see the full table for the selected month and to download a PDF.

- Filename: `madni-masjid-prayer-times-<month>-<year>.pdf` (e.g. `madni-masjid-prayer-times-may-2026.pdf`).
- The PDF includes the masjid name, address, the selected month, and a row for each day with both Start and Jamaat times.
- The PDF is generated entirely in the browser using **jsPDF + AutoTable** (both loaded from a CDN in `index.html`). No server required.

---

## How to manage the About-section carousel

The carousel in the About section is a fade-between slideshow that auto-rotates every five seconds. It hides on hover (so the visitor can read the alt text) and skips any slides whose image file isn't present in `photos/`.

### To add or replace a photo
1. Drop the image file into `mmSource/photos/`.
2. Open `mmSource/index.html` and find the carousel block (search for `masjid-carousel`).
3. The block already has slots wired up for these filenames:
   - `photos/Madni Mssjid.JPG`
   - `photos/before-1.jpg`
   - `photos/before-2.jpg`
   - `photos/after-1.jpg`
   - `photos/after-2.jpg`
4. To use one of those slots, save your image with the matching filename.
5. To use a different filename, edit the `src` on one of the `<li class="carousel-slide">` blocks and update the `alt` text.
6. To add more slides, copy a `<li class="carousel-slide">…</li>` block and increment.

If a referenced image file doesn't exist, that slide is automatically hidden — so you can leave the placeholder slots in place until photos are ready.

---

## How to update address, postcode, email, and map

1. Open `mmSource/index.html`.
2. Use Find (Ctrl+F / Cmd+F):
   - Address: search for `Langside Road`
   - Postcode: search for `G42 8XL`
   - Email: search for `madnimasjid786@gmail.com`
3. Each value appears in the Contact section and the footer — update every occurrence.
4. To change the map, replace the `src` URL of the `<iframe>` in the Contact section with a Google Maps embed URL for the verified address.

---

## How to update donation bank details

Open `mmSource/index.html` and find the Donations section. Update the four rows: Bank, Account Name, Sort Code, Account Number.

---

## How to deploy the site for free

Static files only, so any free static-hosting provider will do. Deploy the contents of `mmSource/` (not the whole repo).

### Netlify
1. Sign in to [netlify.com](https://www.netlify.com).
2. Drag the `mmSource/` folder onto the upload area on the dashboard.
3. You get a free URL such as `https://your-site-name.netlify.app`.
4. To update later, drag the folder onto the same site again.

### Vercel
1. Sign in to [vercel.com](https://vercel.com).
2. Create a new project and upload the folder, or connect a Git repository and set the root directory to `mmSource`.
3. You get a free URL ending in `.vercel.app`.

### GitHub Pages
1. Push the folder to a GitHub repository.
2. In **Settings → Pages**, choose the branch and set the folder to `/mmSource`.

---

## Things to verify before publishing

The site is static and does not calculate prayer times automatically. Confirm the following with the masjid before going live:

- **Jamaat times** — the rules are taken from the 2026 jamaat image. Verify they still apply around the British Summer Time changeover and Ramadan.
- **Fajr jamaat 01:35 override** — confirmed with the masjid as 01:35 until 9 August; double-check before the period starts.
- **Begin times** — confirm against the masjid's own published timetable.
- **Ramadan jamaat times** — left blank in the data and shown as `—` on the page. The masjid's separate Ramadan timetable should be made available each year.
- **Jumu'ah (Friday) times** — Friday rows are tinted amber in the monthly table. The site does not currently show a separate Jumu'ah Khutbah time.
- **Street address** — currently `196 Langside Road`.
- **Postcode** — currently `G42 8XL`.
- **Email** — currently `madnimasjid786@gmail.com`.
- **Bank details** — Bank of Scotland, sort code 80-22-60, account 21492564. Confirm before publishing.
- **Google Maps embed** — open the page and check the map points to the correct building.
- **Carousel photos** — confirm each photo is appropriate and approved for publishing.
- **Class details** — Hifz & Nazara, Mon–Fri 5:00–6:45 pm, ages 5–15, waiting list active. Confirm before publishing.
- **Men-only wording** — confirm this is still accurate.
- **Source of timings** — the spreadsheet is labelled "GCM Prayer Times" (Glasgow Central Mosque). Confirm Madni Masjid follows the same begin-time calculation.
