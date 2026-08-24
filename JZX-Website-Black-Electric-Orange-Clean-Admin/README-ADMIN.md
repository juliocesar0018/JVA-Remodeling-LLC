# JMX Remodeling Website — Admin + Production Edition

Open `index.html` for the public site and `admin.html` for the administration panel.

## Local preview
Without Firebase configured, Admin works as a local preview using Local Storage and IndexedDB. This is useful for design/testing on one browser.

## Production cloud mode
This version is prepared for Firebase Google Sign-In, Firestore and Firebase Storage. Follow `FIREBASE-SETUP.md` for the one-time setup.

When Firebase is enabled:
- Only the authorized Google account can enter/publish Admin changes.
- Site settings are published to Firestore.
- Uploaded website images are stored in Firebase Storage.
- The public website loads published settings for all visitors.

## Admin sections
Company, Hero & Logos, Theme, SEO & Marketing, Production & Cloud, Traffic Counters, Services, Projects, Why Choose Us, Process, Testimonials, FAQ, Catalogue, Payments and Footer.

## SEO and analytics
Admin → SEO & Marketing controls title, description, canonical URL, social share metadata, Search Console verification, Google Business links, LocalBusiness structured data and Google Analytics 4. Analytics click tracking covers important contact/payment calls to action when enabled.

## Security
Never place Firebase service-account keys, payment secret/API keys, card numbers, bank passwords or private credentials in these frontend files. Use only the Firebase public web configuration and public hosted payment URLs.

## Traffic counters
Admin → Traffic Counters shows two visit/page-load counters:
- Current month: automatically uses a new monthly counter on the first day of each month (America/Chicago timezone).
- All-time total: never resets.

Every website load counts again, including repeat visits and refreshes. These are page-load counters, not unique-person analytics. Local preview uses browser storage; production totals require Firebase and the included Firestore rules.

## Visibility switches (v9)
The admin panel now includes visibility switches in two levels:

- A switch beside every left-side admin section and a matching master switch inside each panel.
- Switches beside editable fields, images, service cards, project images, Why Choose Us items, process steps, testimonials, FAQ entries and catalogue slots.

Turning off a public item adds a layout-removal state (`display: none`) on the public site. The browser then reflows the remaining content, so hidden sections and cards do not leave blank placeholders. Turning the switch back on restores the item and the layout expands normally.

Theme and SEO master switches disable their managed public behavior rather than creating a blank visual section, because those settings are not visible sections themselves. The Traffic Counters switch controls whether public visits are counted.
