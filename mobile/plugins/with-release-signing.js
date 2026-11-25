// Signs release builds with RepTrack's own key instead of React Native's public debug key.
// The key and passwords never enter the repo or the generated android/ folder: Gradle reads
// them at build time from a properties file (default ~/.reptrack/signing.properties,
// or the path in RT_SIGNING_PROPERTIES) with storeFile, storePassword, keyAlias, keyPassword.
// Without that file, release builds stay debug-signed (fine for local testing, never for publishing).
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// rt-release-signing'

const LOAD = `
${MARKER}
def rtSigning = new Properties()
def rtSigningFile = file(System.getenv('RT_SIGNING_PROPERTIES') ?: "\${System.getProperty('user.home')}/.reptrack/signing.properties")
if (rtSigningFile.exists()) { rtSigningFile.withInputStream { rtSigning.load(it) } }
`

const RELEASE_CONFIG = `
        release {
            if (rtSigning.storeFile) {
                storeFile file(rtSigning.storeFile)
                storePassword rtSigning.storePassword
                keyAlias rtSigning.keyAlias
                keyPassword rtSigning.keyPassword
            }
        }`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let s = cfg.modResults.contents
    if (s.includes(MARKER)) return cfg

    const replaceOnce = (pattern, replacement, what) => {
      if (!pattern.test(s)) throw new Error(`with-release-signing: ${what} not found in app/build.gradle`)
      s = s.replace(pattern, replacement)
    }
    replaceOnce(/\nandroid \{\n/, `${LOAD}\nandroid {\n`, 'android block')
    replaceOnce(/(signingConfigs \{\n\s+debug \{[^}]*\})/, `$1${RELEASE_CONFIG}`, 'debug signing config')
    replaceOnce(
      /(release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig rtSigning.storeFile ? signingConfigs.release : signingConfigs.debug',
      'release build type',
    )
    cfg.modResults.contents = s
    return cfg
  })
}
