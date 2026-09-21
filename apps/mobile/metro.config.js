// Metro configuration.
//
// expo-sqlite ships a WebAssembly build for web (web/worker.ts imports
// ./wa-sqlite/wa-sqlite.wasm). Metro does not treat .wasm as an asset by
// default, so the web static render fails with "Unable to resolve module
// ./wa-sqlite/wa-sqlite.wasm". Registering it here fixes web bundling and is
// inert for iOS/Android, which never load the web worker.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
