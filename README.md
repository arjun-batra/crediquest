# CrediQuest

**Which card should you swipe?**

CrediQuest is a Canadian credit card rewards optimizer — a PWA that answers one question at the point of purchase: which card in your wallet earns the most right now?

🌐 **Live:** https://arjun-batra.github.io/crediquest/

---

## What it does

- Search by **store name** or **spending category** to instantly rank your cards by earn rate
- Toggle between **raw multiplier** (e.g. 5×) and **effective cash value** (e.g. 10¢ per $1)
- Supports **20 Canadian credit cards** across **25 spending categories** and **629+ stores**
- Handles **Tangerine's bonus category system** — pick your 2–3 categories, results adjust automatically
- Shows **store-specific overrides** where cards earn bonus rates (e.g. Amex Aeroplan earns 2× on Air Canada, not just the base 1×)
- Installable as a **PWA** — works offline, lives on your home screen

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla JS, HTML, CSS — no framework |
| Database | Supabase (PostgreSQL) |
| Hosting | GitHub Pages |
| PWA | Service worker, Web App Manifest |
| Analytics | Custom events table in Supabase |

## Contributing

Found a missing store, wrong earn rate, or a card that should be added? Use the **Contribute** button in the app to submit directly — no GitHub account needed.

For code contributions, open an issue or PR at [github.com/arjun-batra/crediquest](https://github.com/arjun-batra/crediquest).

---

## Disclaimer

For informational purposes only. All trademarks belong to their respective owners. Not affiliated with any merchant or card issuer. Verify earn rates directly with your card issuer — programs change.

---

*Vibe Coded with ❤️ by Arjun · v1.0*
