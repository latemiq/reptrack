# RepTrack

Aplikacja do śledzenia treningów siłowych i biegowych, z panelem dla trenera personalnego i asystentem AI. Działa w przeglądarce (PWA) i jako natywna aplikacja na Androida.

**Demo:** https://reptrack-five-tau.vercel.app

<!-- Zrzuty ekranu: wrzuć pliki do docs/screenshots/ i odkomentuj.
| Dashboard | Trening na żywo | Panel trenera |
|---|---|---|
| ![](docs/screenshots/dashboard.png) | ![](docs/screenshots/workout.png) | ![](docs/screenshots/trainer.png) |
-->

## Funkcje

**Dla trenującego**
- Dziennik siłowni: trening na żywo z timerem przerw, szablony treningów, historia, porównanie z poprzednim treningiem
- Atlas ponad 870 ćwiczeń ze zdjęciami (free-exercise-db), polskie nazwy najpopularniejszych i możliwość dodawania własnych
- Bieganie: lista biegów, szczegóły, **import biegu ze zrzutu ekranu** z zegarka/aplikacji (rozpoznawanie przez Claude Vision)
- Cele (np. ciężar w ćwiczeniu, waga ciała) z automatycznym liczeniem postępu
- AI Coach: czat, który zna historię treningów użytkownika i potrafi się do nich odwoływać
- Dashboard ze statystykami i wykresami, centrum powiadomień

**Dla trenera**
- Zapraszanie podopiecznych linkiem lub kodem QR
- Podgląd treningów podopiecznych (tylko do odczytu) i komentarze do ukończonych treningów
- Planowanie z periodyzacją: makro-, mezo- i mikrocykle z edytorem sesji i ćwiczeń; podopieczny widzi plan i notatki trenera

**Konto i bezpieczeństwo**
- Logowanie przez Clerk
- Własna weryfikacja dwuetapowa zbudowana na darmowym planie Clerk: passkeys (WebAuthn), aplikacja TOTP, kod e-mail, kody zapasowe
- Automatyczne wylogowanie po 60 min bezczynności

## Stack

| Obszar | Technologie |
|---|---|
| Web | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, GSAP, Recharts |
| Stan | Zustand (z `persist` – trening w toku przetrwa odświeżenie strony) |
| Backend | Next.js Route Handlers (~40 endpointów REST w `app/api`) |
| Baza danych | Supabase (PostgreSQL, 21 tabel z Row Level Security) |
| Auth | Clerk + webhooki (Svix), własne 2FA: `@simplewebauthn`, `otplib`, Nodemailer |
| AI | Anthropic API (Claude) – czat AI Coach i odczyt zrzutów ekranu |
| Mobile | Expo / React Native (Expo Router), Clerk Expo |
| Hosting | Vercel; PWA + Trusted Web Activity na Androida |

## Decyzje techniczne

- **Clerk + Supabase zamiast Supabase Auth.** Clerk daje gotowe ekrany logowania i zarządzanie sesją; Supabase służy wyłącznie jako baza. Użytkownicy są synchronizowani do tabeli `profiles` przez webhook Clerka (podpis weryfikowany przez Svix).
- **Dostęp do bazy tylko przez API.** Klucz `service_role` istnieje wyłącznie na serwerze. Każdy endpoint pobiera użytkownika przez `getUserId()` (`lib/api-auth.ts`), które przy włączonym 2FA odmawia dostępu, dopóki sesja nie przejdzie drugiego kroku.
- **Własne 2FA.** Darmowy Clerk nie ma MFA, więc po haśle aplikacja wymaga passkeya, kodu TOTP lub kodu z e-maila i zapisuje wynik w ciasteczku podpisanym HMAC, powiązanym z sesją Clerka (`lib/mfa.ts`). Sekrety TOTP są szyfrowane, a po 5 błędnych próbach konto blokuje się na 15 minut.
- **Tryb deweloperski bez logowania** (`NEXT_PUBLIC_BYPASS_AUTH`) jest ignorowany w buildzie produkcyjnym, więc przypadkowo ustawiona zmienna nie odsłoni danych.

## Struktura projektu

```
app/
  (landing)/        strona główna
  (app)/            aplikacja po zalogowaniu: dashboard, gym, running, goals, coach, trainer…
  api/              endpointy REST
components/         komponenty UI pogrupowane według funkcji
lib/                logika: auth, 2FA, statystyki, plany treningowe, klient Supabase
lib/supabase/schema.sql   schemat bazy
scripts/            seedy (ćwiczenia, dane demo trenera), generowanie ikon
mobile/             aplikacja Expo / React Native
```

## Uruchomienie lokalne

Wymagania: Node.js 20+, projekt w Supabase, konto Clerk.

```bash
npm install
cp .env.example .env.local     # uzupełnij klucze
```

1. W Supabase (SQL Editor) uruchom `lib/supabase/schema.sql`.
2. Załaduj atlas ćwiczeń: `npm run seed:exercises`
3. Uruchom: `npm run dev` → http://localhost:3000

Szybki podgląd bez konta Clerk: ustaw `NEXT_PUBLIC_BYPASS_AUTH=true` w `.env.local`. Dane demo panelu trenera (4 podopiecznych, ~6 tygodni treningów, makrocykl) wgrasz komendą `npm run seed:trainer`.

### Aplikacja mobilna

Opis w [mobile/README.md](mobile/README.md).
