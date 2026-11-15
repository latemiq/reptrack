// Clerk errors are English; map common codes to Polish (same list as the web app).
const MESSAGES: Record<string, string> = {
  form_password_incorrect: 'Nieprawidłowe hasło.',
  form_identifier_not_found: 'Nie ma konta z tym adresem email.',
  form_identifier_exists: 'Konto z tym adresem email już istnieje. Zaloguj się.',
  form_password_pwned: 'To hasło wyciekło w innym serwisie. Wybierz inne.',
  form_password_length_too_short: 'Hasło jest za krótkie — minimum 8 znaków.',
  form_password_not_strong_enough: 'Hasło jest za słabe. Dodaj cyfry i znaki specjalne.',
  form_code_incorrect: 'Nieprawidłowy kod.',
  verification_expired: 'Kod wygasł. Poproś o nowy.',
  verification_failed: 'Weryfikacja nie powiodła się. Spróbuj ponownie.',
  form_param_format_invalid: 'Nieprawidłowy format — sprawdź adres email.',
  form_param_nil: 'Uzupełnij wszystkie pola.',
  form_identifier_invalid: 'Nieprawidłowy adres email.',
  too_many_requests: 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  user_locked: 'Konto jest tymczasowo zablokowane po wielu nieudanych próbach.',
  session_exists: 'Jesteś już zalogowany.',
  network_error: 'Brak połączenia z internetem.',
}

type Shape = { code?: string; errors?: { code?: string }[] } | null | undefined

export function clerkErrorPl(e: unknown): string {
  const err = e as Shape
  const code = err?.errors?.[0]?.code ?? err?.code
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (code) return `Nie udało się (${code}). Spróbuj ponownie.`
  return 'Coś poszło nie tak. Spróbuj ponownie.'
}
