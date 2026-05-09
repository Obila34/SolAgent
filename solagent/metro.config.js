const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  crypto: require.resolve('react-native-get-random-values'),
  stream: require.resolve('readable-stream'),
  buffer: require.resolve('buffer'),
};

module.exports = config;