const path = require('node:path');

function dataPath({ env, appData }) {
  if (env.UNTRACE_DATA_DIR) return env.UNTRACE_DATA_DIR;
  if (env.PORTABLE_EXECUTABLE_DIR) return path.join(env.PORTABLE_EXECUTABLE_DIR, 'Untrace-data');
  return path.join(appData, 'Untrace Desktop');
}

module.exports = { dataPath };
