# RepTrack – aplikacja mobilna

Natywna aplikacja na Androida (Expo / React Native, Expo Router). Korzysta z tego samego API co wersja webowa i loguje przez Clerk.

**Ekrany:** logowanie i rejestracja, start (plan na dziś, szybki start treningu), trening na żywo, historia, profil, dołączenie do trenera kodem zaproszenia.

## Uruchomienie

```bash
cd mobile
npm install
cp .env.example .env.local     # adres API i klucz Clerk
npx expo start
```

## Budowanie APK (Windows)

```bash
bash mobile/scripts/build-apk.sh
```

Natywne moduły C++ przekraczają na Windowsie limit 260 znaków ścieżki, dlatego skrypt kopiuje projekt do krótkiego folderu (`C:\rt`) i buduje tam. Gotowy plik: `C:\rt\android\app\build\outputs\apk\release\app-release.apk`.
