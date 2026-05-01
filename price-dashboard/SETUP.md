# Planet Price Intelligence — Setup Guide

## Šta dobijamo

**Dashboard sa 4 ekrana:**
1. **Pregled** — svako vozilo sa tvojom cijenom vs. min/prosjek/max konkurencije, vizuelna pozicija na skali
2. **Konkurencija** — sve prikupljene cijene po konkurentu
3. **Unos cijena** — ručni unos kada nađeš cijenu na nekom sajtu
4. **Preporuke** — automatski generišu se kada imaš dovoljno podataka, jednim klikom primijeniš

---

## KORAK 1 — Postavi bazu u Supabase

Ako već imaš Supabase projekat (iz avtorent projekta), možeš koristiti isti.

1. Otvori **Supabase → SQL Editor**
2. Klikni **New Query**
3. Kopiraj cijeli sadržaj `supabase_schema.sql` i pokreni

---

## KORAK 2 — Dodaj svoja vozila u bazu

U Supabase → Table Editor → `my_prices`, dodaj svoja vozila:

| category_id | vehicle_model     | base_price | peak_price | peak_start | peak_end   |
|-------------|-------------------|------------|------------|------------|------------|
| economy     | Renault Clio      | 35         | 55         | 2025-06-15 | 2025-09-15 |
| economy     | VW Polo           | 38         | 58         | 2025-06-15 | 2025-09-15 |
| compact     | VW Golf           | 45         | 70         | 2025-06-15 | 2025-09-15 |
| suv         | Dacia Duster      | 55         | 85         | 2025-06-15 | 2025-09-15 |
| electric    | Renault ZOE 400km | 60         | 75         | 2025-06-15 | 2025-09-15 |
| electric    | Renault ZOE 120km | 40         | 50         | 2025-06-15 | 2025-09-15 |
| van         | Renault Kangoo    | 60         | 80         | 2025-06-15 | 2025-09-15 |

---

## KORAK 3 — Novi GitHub repo i deploy na Vercel

### Option A: Dodaj kao novi folder u postojeći repo
```bash
# U tvom lokalnom avtorent2 folderu
mkdir price-dashboard
# Kopiraj sve fajlove iz ovog ZIP-a u price-dashboard/
git add price-dashboard/
git commit -m "Add price intelligence dashboard"
git push
```
Vercel automatski deploya. Dashboard će biti na: `planetrentacar.me/price-dashboard`

### Option B: Poseban repo (preporučeno za čistoću)
```bash
cd price-dashboard
git init
git remote add origin https://github.com/edinsu-collab/planet-prices.git
git add .
git commit -m "Initial commit"
git push -u origin main
```
Vercel → New Project → importuješ novi repo → deploya se na poseban URL (npr. `planet-prices.vercel.app`)

---

## KORAK 4 — Environment varijable na Vercel

Vercel → tvoj projekt → Settings → Environment Variables, dodaj:

```
NEXT_PUBLIC_SUPABASE_URL      = (iz Supabase Settings → API)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (anon public key)
SUPABASE_SERVICE_ROLE_KEY     = (service_role key)
SCRAPER_SECRET                = (izmisli nešto, npr. planet2025secret)
CRON_SECRET                   = (izmisli nešto drugo)
```

---

## KORAK 5 — Playwright za automatski scraping

Playwright se ne može koristiti na Vercel (serverless ograničenje). Opcije:

### A) Lokalno pokretanje (besplatno, radi odmah)
```bash
cd price-dashboard
npm install
npx playwright install chromium
npx ts-node scripts/scraper.ts
```
Pokreni jednom dnevno s lokalnog računara ili postavi Windows Task Scheduler / cron.

### B) Railway.app (10$ miesečno, uvijek radi)
Deployaj scraper kao poseban Node.js servis na Railway.
Cron: `0 7 * * *` → pokreće scraper svako jutro u 7h.

### C) Manuelni unos (bez instalacije, odmah)
Tab "Unos cijena" u dashboardu — uneseš cijenu koju vidiš na sajtu, odmah se pravi analiza.

---

## Workflow — kako koristiti svaki dan

1. Otvori dashboard
2. **Provjeri Pregled** — jesu li se promijenile cijene? Crvena = ti si skuplji, zelena = možeš podići
3. **Provjeri Preporuke** — klikni "Primijeni" za preporuke koje prihvataš
4. **Unesi manuelno** cijene sa Rentalcars/Sixt koje si provjero
5. Sačuvaj promjene cijena na svom sajtu

---

## Roadmap za sljedeće faze

- [ ] **Direktna konekcija sa planetrentacar.me** — klik na "Primijeni" automatski mijenja cijenu na sajtu
- [ ] **Email alert** — šalje ti mejl kada konkurent drastično promijeni cijenu
- [ ] **Historijski grafovi** — kako su se mijenjale cijene tokom sezone
- [ ] **Yield management** — automatska korekcija na osnovu popunjenosti flote
