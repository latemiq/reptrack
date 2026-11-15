// Windows only: the native (CMake/ninja) build of codegen modules such as
// react-native-gesture-handler creates paths longer than 260 characters, which the
// bundled ninja cannot handle. Moving the CMake staging folder to a short path
// (C:/rtx) keeps every path under the limit. No effect on other platforms.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// rt-short-cxx-dir'

module.exports = function withShortCxxDir(config) {
  if (process.platform !== 'win32') return config
  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.contents.includes(MARKER)) return cfg
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /\nandroid \{\n/,
      `\nandroid {\n    ${MARKER}\n    externalNativeBuild { cmake { buildStagingDirectory = file("C:/rtx") } }\n`,
    )
    return cfg
  })
}
