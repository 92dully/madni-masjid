/*
  script.js — Madni Masjid Website
  ===================================
  Handles:
  1. Navbar style change on scroll
  2. Mobile hamburger menu
  3. Footer copyright year
  4. Prayer times — today's summary, next-prayer countdown, monthly table
  5. PDF download using jsPDF + AutoTable
  6. About-section photo carousel — auto-rotates with manual controls
*/


/* ==============================================
   1. NAVBAR
   ============================================== */
const navbar = document.getElementById('navbar');

function handleNavbarScroll() {
  navbar.classList.toggle('nav-scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', handleNavbarScroll);
handleNavbarScroll();


/* ==============================================
   2. MOBILE MENU
   ============================================== */
const menuBtn    = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

function setMenuOpen(isOpen) {
  mobileMenu.classList.toggle('hidden', !isOpen);
  menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  menuBtn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
}

menuBtn.addEventListener('click', function () {
  setMenuOpen(mobileMenu.classList.contains('hidden'));
});

document.querySelectorAll('.mobile-link').forEach(function (link) {
  link.addEventListener('click', function () { setMenuOpen(false); });
});


/* ==============================================
   3. FOOTER YEAR
   ============================================== */
const footerYear = document.getElementById('footer-year');
if (footerYear) footerYear.textContent = new Date().getFullYear();


/* ==============================================
   4. PRAYER TIMES
   ============================================== */

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function pad(n) { return n < 10 ? '0' + n : String(n); }

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatLongDate(isoDate, dayName) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return dayName + ', ' + d + ' ' + MONTH_NAMES[m - 1] + ' ' + y;
}

function showOrDash(v) { return v || '—'; }

const PRAYER_NAMES = ['Fajr', 'Zohar', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_KEYS  = ['fajr', 'zohar', 'asr', 'maghrib', 'isha'];


/* ---- TODAY SUMMARY ---- */
/*
  TODAY TABLE — 6 columns (Label + 5 prayers)

  We don't repeat the date inside the table — the card already shows the
  long date ("Saturday, 16 May 2026") above the table. Dropping the date
  column means each remaining column gets more room, which is what lets
  the table fit on mobile without a horizontal scroll.

  All cells are centre-aligned by `.prayer-table` in style.css.
*/
function renderTodaySummary(days) {
  const box = document.getElementById('today-summary');
  if (!box) return;

  const iso = todayISO();
  const day = days.find(function (d) { return d.date === iso; });

  if (!day) {
    box.innerHTML = '<p class="text-gray-700 dark:text-gray-300 text-sm">Prayer times for today are not available. Please check the monthly timetable.</p>';
    return;
  }

  let html =
    '<div class="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-3 gap-1">' +
    '<h3 class="font-semibold text-gray-800 dark:text-gray-100">Today</h3>' +
    '<p class="text-gray-500 dark:text-gray-400 text-xs">' + formatLongDate(day.date, day.day) + '</p>' +
    '</div>';

  /*
    NEXT-PRAYER COUNTDOWN PLACEHOLDER
    Filled by updateNextPrayer() right after this render, then refreshed
    every 30 seconds. Sits between the date line and the Start/Jamaat
    table so it's the first thing a visitor sees on the Today card.
  */
  html += '<div id="next-prayer" class="next-prayer" style="display:none"></div>';

  html += '<div class="table-scroll">';
  html += '<table class="prayer-table">';

  /* 6-column geometry: label + 5 prayer columns */
  html += '<colgroup>' +
    '<col class="col-label">' +
    '<col class="col-prayer">' +
    '<col class="col-prayer">' +
    '<col class="col-prayer">' +
    '<col class="col-prayer">' +
    '<col class="col-prayer">' +
    '</colgroup>';

  /* Header — no Tailwind classes; styling lives in .prayer-table thead th */
  html += '<thead><tr>';
  html += '<th class="prayer-col-label"></th>';
  PRAYER_NAMES.forEach(function (name) {
    html += '<th class="prayer-col-time">' + name + '</th>';
  });
  html += '</tr></thead>';

  /* Start time row */
  html += '<tbody>';
  html += '<tr>';
  html += '<td class="label-cell">Start</td>';
  PRAYER_KEYS.forEach(function (k) {
    html += '<td class="time-cell text-gray-700 dark:text-gray-300">' + showOrDash(day[k + '_begin']) + '</td>';
  });
  html += '</tr>';

  /* Jamaat time row */
  html += '<tr>';
  html += '<td class="label-cell">Jamaat</td>';
  PRAYER_KEYS.forEach(function (k) {
    html += '<td class="time-cell font-semibold text-gray-900 dark:text-gray-100">' + showOrDash(day[k + '_jamaat']) + '</td>';
  });
  html += '</tr>';
  html += '</tbody></table></div>';

  box.innerHTML = html;
}


/* ---- NEXT-PRAYER COUNTDOWN ---- */
/*
  Live "Next prayer in 1h 23m" banner shown on the Today card.

  Algorithm:
    - Look at TODAY's five prayers first, then TOMORROW's as fallback.
    - Prefer JAMAAT times — those are what mosque-goers time themselves
      against. Fall back to BEGIN times when jamaat is null (Ramadan).
    - Return the first prayer whose time is still in the future relative
      to right now.

  Refresh cadence:
    setInterval calls updateNextPrayer every 30 seconds. When a prayer
    time passes, the banner automatically advances to the next one —
    no page reload required.

  Display:
    "Next Prayer" eyebrow  →  "Asr Jamaat at 19:15"
    Start card             →  "Start at 22:25"   "in 4m 10s"
    Jamaat card            →  "Jamaat at 23:00"  "in 38m 10s"
*/

function dateToISO(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function getNextPrayer(days) {
  const now = new Date();

  /*
    Builds candidate prayer objects for one day. `baseDate` is the
    calendar day to anchor the times to — so we can build "tomorrow"
    candidates by passing tomorrow's Date object.
  */
  function buildCandidates(day, baseDate) {
    const list = [];
    if (!day) return list;
    PRAYER_KEYS.forEach(function (key, i) {
      const jamaat = day[key + '_jamaat'];
      const begin  = day[key + '_begin'];
      const targetTime = jamaat || begin;  /* fallback for Ramadan days */
      if (!targetTime) return;

      function timeToDate(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), h, m, 0);
      }

      list.push({
        name:       PRAYER_NAMES[i],
        begin:      begin,
        jamaat:     jamaat,
        beginWhen:  begin ? timeToDate(begin) : null,
        jamaatWhen: jamaat ? timeToDate(jamaat) : null,
        targetTime: targetTime,
        isJamaat:  !!jamaat,
        when:       timeToDate(targetTime),
      });
    });
    return list;
  }

  const today = days.find(function (d) { return d.date === dateToISO(now); });

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = days.find(function (d) { return d.date === dateToISO(tomorrowDate); });

  const all = buildCandidates(today, now).concat(buildCandidates(tomorrow, tomorrowDate));
  return all.find(function (c) { return c.when > now; }) || null;
}

/*
  Formats a millisecond gap as a live countdown including seconds:
    "in 1h 23m 45s"  →  hours present
    "in 23m 45s"     →  minutes present, no hours
    "in 45s"         →  under a minute
    "now"            →  reached / passed
  Minutes and seconds are zero-padded to two digits ONLY when a larger
  unit is also present — that keeps "in 5s" looking natural while
  preventing "in 1h 5m 3s" from jiggling as the digits tick.
*/
function formatCountdown(ms) {
  if (ms <= 0) return 'now';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  if (h > 0) return 'in ' + h + 'h ' + pad2(m) + 'm ' + pad2(s) + 's';
  if (m > 0) return 'in ' + m + 'm ' + pad2(s) + 's';
  return 'in ' + s + 's';
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return 'just now';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  if (h > 0) return h + 'h ' + pad2(m) + 'm ago';
  return m + 'm ago';
}

function formatPrayerRelativeTime(when, now) {
  const gap = when - now;
  if (gap >= 0) return formatCountdown(gap);
  return formatElapsed(Math.abs(gap));
}

function updateNextPrayer(days) {
  const box = document.getElementById('next-prayer');
  if (!box) return;

  const next = getNextPrayer(days);
  if (!next) { box.style.display = 'none'; return; }
  box.style.display = '';

  const now       = new Date();
  const countdown = formatCountdown(next.when - now);
  /* If the prayer's calendar date differs from today's, flag it as tomorrow */
  const dayNote   = (next.when.getDate() !== now.getDate()) ? ' tomorrow' : '';
  const startNote = (next.beginWhen && next.beginWhen.getDate() !== now.getDate()) ? ' tomorrow' : '';
  const jamaatNote = (next.jamaatWhen && next.jamaatWhen.getDate() !== now.getDate()) ? ' tomorrow' : '';
  const startCountdown = next.beginWhen ? formatPrayerRelativeTime(next.beginWhen, now) : '';
  const jamaatCountdown = next.jamaatWhen ? formatPrayerRelativeTime(next.jamaatWhen, now) : countdown;
  const startPastClass = next.beginWhen && next.beginWhen < now ? ' is-past' : '';
  const jamaatPastClass = next.jamaatWhen && next.jamaatWhen < now ? ' is-past' : '';
  const typeLabel = next.isJamaat ? ' Jamaat' : ' Start';
  const gridClass = next.jamaat ? 'next-prayer-times' : 'next-prayer-times is-single';
  const startBlock = next.begin ?
    '<div class="next-prayer-time-card' + startPastClass + '">' +
      '<div class="next-prayer-time-meta">' +
        '<span class="next-prayer-time-label">Start</span>' +
        '<span class="next-prayer-time-value">at ' + next.begin + startNote + '</span>' +
      '</div>' +
      '<span class="next-prayer-countdown">' + startCountdown + '</span>' +
    '</div>' :
    '';
  const jamaatBlock = next.jamaat ?
    '<div class="next-prayer-time-card' + jamaatPastClass + '">' +
      '<div class="next-prayer-time-meta">' +
        '<span class="next-prayer-time-label">Jamaat</span>' +
        '<span class="next-prayer-time-value">at ' + next.jamaat + jamaatNote + '</span>' +
      '</div>' +
      '<span class="next-prayer-countdown">' + jamaatCountdown + '</span>' +
    '</div>' :
    '';

  box.innerHTML =
    '<div class="next-prayer-label">Next Prayer</div>' +
    '<div class="next-prayer-row">' +
      '<div class="next-prayer-main">' +
        '<span class="next-prayer-name">' + next.name + typeLabel + '</span>' +
        '<span class="next-prayer-time">at ' + next.targetTime + dayNote + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="' + gridClass + '">' +
      startBlock +
      jamaatBlock +
    '</div>';
}


/* ---- MONTH SELECT ---- */
function getMonthKeys(days) {
  const seen = {}, keys = [];
  days.forEach(function (d) {
    const key = d.date.slice(0, 7);
    if (!seen[key]) { seen[key] = true; keys.push(key); }
  });
  return keys.sort();
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return MONTH_NAMES[m - 1] + ' ' + y;
}

function populateMonthSelect(days) {
  const sel = document.getElementById('month-select');
  if (!sel) return;
  const keys = getMonthKeys(days);
  sel.innerHTML = '';
  keys.forEach(function (k) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = monthLabel(k);
    sel.appendChild(opt);
  });
  const todayKey = todayISO().slice(0, 7);
  sel.value = keys.includes(todayKey) ? todayKey : keys[0];
}


/* ---- MONTHLY TABLE ---- */
function renderMonthTable(days, monthKey) {
  const tbody = document.getElementById('month-rows');
  if (!tbody) return;

  const rows = days.filter(function (d) { return d.date.slice(0, 7) === monthKey; });

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 px-3 text-center text-gray-500 dark:text-gray-400">No timetable available for this month.</td></tr>';
    return;
  }

  const todayDate = todayISO();
  let html = '';

  rows.forEach(function (d) {
    const dayNum    = parseInt(d.date.slice(8), 10);
    const dayLetter = (d.day || '').slice(0, 3);
    const isToday   = d.date === todayDate;
    const isFriday  = d.day === 'Friday';

    /* CSS classes for row highlights (dark-mode-aware via style.css) */
    const rowClass = isToday ? 'row-today' : isFriday ? 'row-friday' : '';

    /* Start time row */
    html += '<tr class="' + rowClass + '">';
    html += '<td class="prayer-col-date" rowspan="2">';
    html += '<span class="font-semibold text-gray-900 dark:text-gray-100">' + dayNum + '</span> ';
    html += '<span class="text-gray-500 dark:text-gray-400" style="font-size:0.65rem">' + dayLetter + '</span>';
    html += '</td>';
    html += '<td class="label-cell">Start</td>';
    PRAYER_KEYS.forEach(function (k) {
      html += '<td class="time-cell text-gray-700 dark:text-gray-300">' + showOrDash(d[k + '_begin']) + '</td>';
    });
    html += '</tr>';

    /* Jamaat row */
    html += '<tr class="' + rowClass + '">';
    html += '<td class="label-cell" style="padding-bottom:8px">Jamaat</td>';
    PRAYER_KEYS.forEach(function (k) {
      html += '<td class="time-cell font-semibold text-gray-900 dark:text-gray-100" style="padding-bottom:8px">' + showOrDash(d[k + '_jamaat']) + '</td>';
    });
    html += '</tr>';
  });

  tbody.innerHTML = html;
}


/* ==============================================
   5. PDF DOWNLOAD — replaces CSV
   ============================================== */
/*
  HOW THIS WORKS:
  ===============
  jsPDF is loaded in index.html from a CDN.
  The AutoTable plugin extends jsPDF to draw clean tables.
  We build the data array from PRAYER_TIMES_DATA and call doc.autoTable().
  No server, no upload — the PDF is generated and downloaded instantly.
*/

function downloadMonthPDF(days, monthKey) {
  /* Safety check: make sure jsPDF loaded */
  if (typeof window.jspdf === 'undefined') {
    alert('PDF library not loaded. Please check your internet connection and try again.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const [y, m] = monthKey.split('-').map(Number);
  const monthName = MONTH_NAMES[m - 1] + ' ' + y;

  /* ---- Header ---- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(6, 95, 70);              /* emerald-800 */
  doc.text('Madni Masjid', 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('196 Langside Road, Glasgow, G42 8XL', 105, 24, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('Prayer Timetable — ' + monthName, 105, 32, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('The mosque is open 15 minutes before and after every Jamaat.', 105, 38, { align: 'center' });

  /* ---- Table data ---- */
  const tableRows = [];
  const monthDays = days.filter(function (d) { return d.date.slice(0, 7) === monthKey; });

  monthDays.forEach(function (d) {
    const dayNum    = parseInt(d.date.slice(8), 10);
    const dayLetter = (d.day || '').slice(0, 3);
    const dateLabel = dayNum + ' ' + dayLetter;

    /* Row 1: Begin times */
    tableRows.push([
      { content: dateLabel, rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 8 } },
      { content: 'Start', styles: { textColor: [120, 120, 120], fontSize: 7 } },
      showOrDash(d.fajr_begin),
      showOrDash(d.zohar_begin),
      showOrDash(d.asr_begin),
      showOrDash(d.maghrib_begin),
      showOrDash(d.isha_begin),
    ]);

    /* Row 2: Jamaat times */
    tableRows.push([
      { content: 'Jamaat', styles: { textColor: [120, 120, 120], fontSize: 7 } },
      { content: showOrDash(d.fajr_jamaat),    styles: { fontStyle: 'bold' } },
      { content: showOrDash(d.zohar_jamaat),   styles: { fontStyle: 'bold' } },
      { content: showOrDash(d.asr_jamaat),     styles: { fontStyle: 'bold' } },
      { content: showOrDash(d.maghrib_jamaat), styles: { fontStyle: 'bold' } },
      { content: showOrDash(d.isha_jamaat),    styles: { fontStyle: 'bold' } },
    ]);
  });

  /* ---- Draw table ---- */
  /*
    PDF mirrors the on-page table: prayer times are CENTRE-aligned so
    each value sits under its column heading. Date and label columns
    stay left-aligned since they hold short text labels, not numbers.
  */
  doc.autoTable({
    startY: 43,
    head: [[
      { content: 'Date',    styles: { halign: 'left'   } },
      { content: '',        styles: { halign: 'left'   } },
      { content: 'Fajr',    styles: { halign: 'center' } },
      { content: 'Zohar',   styles: { halign: 'center' } },
      { content: 'Asr',     styles: { halign: 'center' } },
      { content: 'Maghrib', styles: { halign: 'center' } },
      { content: 'Isha',    styles: { halign: 'center' } },
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor:  [6, 95, 70],    /* emerald-800 */
      textColor:  [255, 255, 255],
      fontStyle:  'bold',
      fontSize:   8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize:    8,
      cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
    },
    alternateRowStyles: { fillColor: [245, 245, 244] },   /* stone-100 */
    columnStyles: {
      0: { cellWidth: 18, halign: 'left'   },   /* Date */
      1: { cellWidth: 16, halign: 'left'   },   /* Start/Jamaat label */
      2: { halign: 'center' },                  /* Fajr */
      3: { halign: 'center' },                  /* Zohar */
      4: { halign: 'center' },                  /* Asr */
      5: { halign: 'center' },                  /* Maghrib */
      6: { halign: 'center' },                  /* Isha */
    },
    margin: { left: 10, right: 10 },
    /* Friday rows get a light amber tint */
    didParseCell: function (data) {
      if (data.section === 'body' && data.row.index % 2 === 0) {
        /* Even index = Start row; find the matching day */
        const dayIdx = Math.floor(data.row.index / 2);
        if (monthDays[dayIdx] && monthDays[dayIdx].day === 'Friday') {
          data.cell.styles.fillColor = [255, 251, 235]; /* amber-50 */
        }
      }
    },
  });

  /* ---- Footer note ---- */
  const finalY = doc.lastAutoTable.finalY || 270;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Timings may sometimes change. Please confirm with the masjid. ' +
    'Maghrib Jamaat = Maghrib begin time.',
    105, finalY + 6, { align: 'center' }
  );

  /* ---- Save ---- */
  const shortMonths = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  doc.save('madni-masjid-prayer-times-' + shortMonths[m - 1] + '-' + y + '.pdf');
}


/* ---- ERROR STATE ---- */
function showLoadError(message) {
  const today = document.getElementById('today-summary');
  if (today) today.innerHTML = '<p class="text-gray-700 dark:text-gray-300 text-sm">' + message + '</p>';
  const tbody = document.getElementById('month-rows');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="py-6 px-3 text-center text-gray-500 dark:text-gray-400">' + message + '</td></tr>';
  const sel = document.getElementById('month-select');
  if (sel) { sel.innerHTML = '<option>Unavailable</option>'; sel.disabled = true; }
}


/* ---- INIT ---- */
function initPrayerTimes() {
  const sel  = document.getElementById('month-select');
  const btn  = document.getElementById('download-btn');
  const days = Array.isArray(window.PRAYER_TIMES_DATA) ? window.PRAYER_TIMES_DATA : null;

  if (!days || days.length === 0) { showLoadError('Prayer times data could not be loaded.'); return; }
  if (!sel || !btn) return;

  populateMonthSelect(days);
  renderTodaySummary(days);
  /*
    Populate the next-prayer banner immediately, then refresh every
    second so the "Xs" suffix ticks live. Updating a small node once a
    second is cheap (modern browsers batch the layout). When a prayer
    time passes, the next call to updateNextPrayer naturally advances
    to the following prayer with no reload.
  */
  updateNextPrayer(days);
  setInterval(function () { updateNextPrayer(days); }, 1000);

  renderMonthTable(days, sel.value);
  btn.disabled = false;

  sel.addEventListener('change', function () { renderMonthTable(days, sel.value); });

  /* PDF download — was CSV */
  btn.addEventListener('click', function () { downloadMonthPDF(days, sel.value); });
}

initPrayerTimes();


/* ==============================================
   6. ABOUT-SECTION CAROUSEL + LIGHTBOX
   ============================================== */
/*
  Carousel behaviour:
  - Each .carousel-slide contains a placeholder layered behind an <img>.
    When the image file is missing, CSS hides the broken <img> so the
    placeholder shows through — the slide stays in the rotation either
    way, so the carousel always cycles through all five.
  - Auto-advances every AUTOPLAY_MS milliseconds.
  - Pauses on hover, on focus, and while the lightbox is open.
  - Manual prev/next buttons, clickable indicator dots, and ←/→ keys.
  - Respects prefers-reduced-motion (skips the auto-advance entirely).

  Lightbox behaviour:
  - Clicking the active slide opens the lightbox with a larger copy of
    the same image (or a larger placeholder if the image is missing).
  - Closes via × button, Esc key, or clicking the dark backdrop.
  - Autoplay is paused while the lightbox is open and resumes on close.
*/
(function () {
  const carousel = document.getElementById('masjid-carousel');
  if (!carousel) return;

  const prevBtn       = carousel.querySelector('.carousel-prev');
  const nextBtn       = carousel.querySelector('.carousel-next');
  const dotsContainer = carousel.querySelector('.carousel-dots');
  const allSlides     = Array.from(carousel.querySelectorAll('.carousel-slide'));

  const lightbox        = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightbox-content');
  const lightboxClose   = document.getElementById('lightbox-close');

  const AUTOPLAY_MS = 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentIndex  = 0;
  let autoplayTimer = null;

  initSlides();

  /* ---------- CAROUSEL ---------- */

  function initSlides() {
    if (allSlides.length === 0) {
      carousel.style.display = 'none';
      return;
    }
    if (allSlides.length === 1) {
      /* Only one slide — hide the navigation chrome */
      if (prevBtn)       prevBtn.style.display = 'none';
      if (nextBtn)       nextBtn.style.display = 'none';
      if (dotsContainer) dotsContainer.style.display = 'none';
      allSlides[0].classList.add('is-active');
      attachSlideClick(allSlides[0]);
      return;
    }
    buildDots();
    allSlides.forEach(attachSlideClick);
    goToSlide(0);
    if (!reducedMotion) startAutoplay();
  }

  function buildDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    allSlides.forEach(function (_, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', 'Go to photo ' + (i + 1));
      dot.addEventListener('click', function () {
        goToSlide(i);
        resetAutoplay();
      });
      dotsContainer.appendChild(dot);
    });
  }

  function goToSlide(index) {
    currentIndex = (index + allSlides.length) % allSlides.length;
    allSlides.forEach(function (s) { s.classList.remove('is-active'); });
    allSlides[currentIndex].classList.add('is-active');

    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.carousel-dot');
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === currentIndex);
        d.setAttribute('aria-current', i === currentIndex ? 'true' : 'false');
      });
    }
  }

  function next() { goToSlide(currentIndex + 1); }
  function prev() { goToSlide(currentIndex - 1); }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(next, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }
  function resetAutoplay() {
    if (reducedMotion) return;
    /* Don't resume if the lightbox is currently visible */
    if (lightbox && !lightbox.hidden) return;
    startAutoplay();
  }

  if (nextBtn) nextBtn.addEventListener('click', function () { next(); resetAutoplay(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); resetAutoplay(); });

  /* Pause autoplay when the user is interacting with the carousel */
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', resetAutoplay);
  carousel.addEventListener('focusin',  stopAutoplay);
  carousel.addEventListener('focusout', resetAutoplay);

  /* Keyboard nav when the carousel is focused */
  carousel.tabIndex = 0;
  carousel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft')  { prev(); resetAutoplay(); }
    if (e.key === 'ArrowRight') { next(); resetAutoplay(); }
  });


  /* ---------- LIGHTBOX ---------- */

  /*
    Attach a click handler to a slide so clicking the image (or its
    placeholder) opens the lightbox. We listen on the slide, not on the
    inner <img>, so clicking the placeholder area works the same way as
    clicking the image — keeping the behaviour predictable.
  */
  function attachSlideClick(slide) {
    slide.addEventListener('click', function (e) {
      /* Ignore clicks that came from prev/next buttons (which sit on top) */
      if (e.target.closest('.carousel-btn')) return;
      openLightbox(slide);
    });
  }

  function openLightbox(slide) {
    if (!lightbox || !lightboxContent) return;

    /* Clear previous contents */
    lightboxContent.innerHTML = '';

    const isMissing   = slide.classList.contains('img-missing');
    const placeholder = slide.querySelector('.slide-placeholder');
    const img         = slide.querySelector('img');

    if (isMissing && placeholder) {
      /* No real photo — show a larger version of the placeholder card */
      const big = placeholder.cloneNode(true);
      big.removeAttribute('aria-hidden');
      lightboxContent.appendChild(big);
    } else if (img) {
      /* Build a fresh <img> for the lightbox (cloning would re-trigger onerror) */
      const big = document.createElement('img');
      big.src = img.src;
      big.alt = img.alt || '';
      lightboxContent.appendChild(big);

    }

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';     /* lock background scroll */
    stopAutoplay();                              /* pause carousel rotation */

    /* Move focus to the close button so Esc / Tab work intuitively */
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxContent.innerHTML = '';
    document.body.style.overflow = '';
    resetAutoplay();
  }

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    /*
      Backdrop click closes the lightbox, but clicks on the image itself
      don't (those bubble up from .lightbox-content). We
      detect a backdrop click by checking the event target was the
      .lightbox container, not one of its inner children.
    */
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  /* Esc key closes the lightbox */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });

}());


/* ==============================================
   REFURBISHMENT GALLERY — BEFORE / AFTER LIGHTBOX
   ============================================== */
/*
  Hooks the .ba-img-wrap panels in the Gallery section into the
  existing lightbox (#lightbox / #lightbox-content / #lightbox-close).
  
  When a panel is clicked (or activated via keyboard), we:
  1. Read data-lightbox-src and data-lightbox-alt from the wrapper
  2. If the wrapper has .ba-missing, show a styled placeholder instead
  3. Open the existing lightbox — reusing all its close/Esc logic
  
  No new lightbox is created; we extend the one already built for the
  carousel. The gallery and carousel lightboxes share the same overlay.
*/
(function () {
  const lightbox        = document.getElementById('lightbox');
  const lightboxContent = document.getElementById('lightbox-content');
  const lightboxClose   = document.getElementById('lightbox-close');

  if (!lightbox || !lightboxContent) return;

  /* Helper: open the lightbox with a given src / alt (or placeholder) */
  function openGalleryLightbox(wrap) {
    const src     = wrap.dataset.lightboxSrc  || '';
    const alt     = wrap.dataset.lightboxAlt  || '';
    const missing = wrap.classList.contains('ba-missing');

    lightboxContent.innerHTML = '';

    if (missing || !src) {
      /* No real photo yet — show an enlarged "Photo coming soon" card */
      const ph = document.createElement('div');
      ph.className = 'slide-placeholder';       /* reuse existing lightbox placeholder styles */
      ph.innerHTML =
        '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5">' +
          '<rect x="3" y="9" width="26" height="18" rx="2"/>' +
          '<path d="M11 9 L13 6 L19 6 L21 9"/>' +
          '<circle cx="16" cy="18" r="5"/>' +
        '</svg>' +
        '<div class="placeholder-label">Photo coming soon</div>' +
        '<div class="placeholder-sub">Drop image files into the photos/ folder to activate this slot.</div>';
      lightboxContent.appendChild(ph);
    } else {
      /* Build a fresh <img> so onerror doesn't bleed from the thumbnail */
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      lightboxContent.appendChild(img);
    }

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    if (lightboxClose) lightboxClose.focus();
  }

  /* Attach click + keyboard listeners to every gallery panel */
  document.querySelectorAll('.ba-img-wrap').forEach(function (wrap) {

    wrap.addEventListener('click', function () {
      openGalleryLightbox(wrap);
    });

    /* Keyboard: Enter or Space activates the panel (for accessibility) */
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGalleryLightbox(wrap);
      }
    });
  });

}());
