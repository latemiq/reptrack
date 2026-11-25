// Publishes the release APK for download from the website.
//
//   bash mobile/scripts/build-apk.sh        (builds C:\rt\...\app-release.apk with the RepTrack key)
//   node mobile/scripts/publish-apk.mjs     (run from the repo root)
//
// Refuses a debug-signed APK, uploads it to the public Supabase bucket "downloads" under a
// unique name (so CDN caches never serve an old file), and writes lib/android-app.ts, which
// the /android page reads. Commit and push that file to show the new version on the site.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(join(process.cwd(), 'package.json'))
require('dotenv').config({ path: '.env.local', quiet: true })
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'downloads'
const APK = process.env.APK_PATH ?? 'C:/rt/android/app/build/outputs/apk/release/app-release.apk'
const MAX_BYTES = 50 * 1024 * 1024 // Supabase free plan limit per file

const fail = msg => { console.error(`✗ ${msg}`); process.exit(1) }

// 1. Signed with RepTrack's key, not React Native's public debug key.
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
const buildTools = join(sdk, 'build-tools')
const latest = readdirSync(buildTools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()
const certs = execFileSync(join(buildTools, latest, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'),
  ['verify', '--print-certs', APK], { encoding: 'utf8', shell: process.platform === 'win32' })
const dn = certs.match(/certificate DN: (.+)/)?.[1]?.trim()
const certSha = certs.match(/certificate SHA-256 digest: ([0-9a-f]+)/)?.[1]
if (!dn || !certSha) fail('apksigner could not read the signature')
if (/Android Debug/.test(dn)) fail('APK is signed with the public debug key. Build it with ~/.reptrack/signing.properties.')

// 2. File facts.
const bytes = readFileSync(APK)
if (bytes.length > MAX_BYTES) fail(`APK is ${(bytes.length / 1048576).toFixed(1)} MB; the storage limit is 50 MB`)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const { expo } = JSON.parse(readFileSync('mobile/app.json', 'utf8'))
const version = expo.version
const versionCode = expo.android?.versionCode ?? 1
const path = `android/RepTrack-${version}-${sha256.slice(0, 8)}.apk`

// 3. Upload.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: bucket } = await supabase.storage.getBucket(BUCKET)
if (!bucket) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['application/vnd.android.package-archive'],
  })
  if (error) fail(`create bucket: ${error.message}`)
  console.log(`→ Utworzono publiczny bucket "${BUCKET}"`)
} else if (!bucket.public) fail(`bucket "${BUCKET}" exists but is not public`)

const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
  contentType: 'application/vnd.android.package-archive',
  cacheControl: '31536000', // the name changes with every file, so it can be cached for good
  upsert: false,
})
if (upErr && !/exists/i.test(upErr.message)) fail(`upload: ${upErr.message}`)
const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

// 4. Check what the public actually gets.
const res = await fetch(url)
const served = Buffer.from(await res.arrayBuffer())
const servedSha = createHash('sha256').update(served).digest('hex')
if (!res.ok || servedSha !== sha256) fail(`public URL returned ${res.status}, sha ${servedSha.slice(0, 12)}…`)

// 5. What the website shows.
const info = {
  version,
  versionCode,
  url,
  fileName: `RepTrack-${version}.apk`,
  sizeBytes: bytes.length,
  sha256,
  certSha256: certSha,
  minAndroid: '7.0',
  publishedAt: new Date(statSync(APK).mtime).toISOString().slice(0, 10),
}
writeFileSync('lib/android-app.ts', `// Written by mobile/scripts/publish-apk.mjs — don't edit by hand.
export const ANDROID_APP = ${JSON.stringify(info, null, 2).replace(/"([a-zA-Z0-9]+)":/g, '$1:').replace(/"/g, "'")} as const
`)

console.log(`✓ Opublikowano ${info.fileName} (${(bytes.length / 1048576).toFixed(1)} MB)`)
console.log(`  ${url}`)
console.log(`  SHA-256 pliku: ${sha256}`)
console.log(`  podpis: ${dn} · ${certSha}`)
console.log('  Zapisano lib/android-app.ts — zacommituj go, żeby strona pokazała nową wersję.')
