const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Limit workers to prevent memory exhaustion on Windows/CI
config.maxWorkers = 2;

// Watch only the local directory
config.watchFolders = [__dirname];

// Block parent node_modules and Next.js build directories
const blockList = [
  /.*[/\\]nextalk[/\\]node_modules[/\\].*/,
  /.*[/\\]nextalk[/\\]\.next[/\\].*/,
];

if (config.resolver.blockList) {
  if (Array.isArray(config.resolver.blockList)) {
    config.resolver.blockList.push(...blockList);
  } else {
    // If it's a RegExp or another form, we can combine it
    config.resolver.blockList = [config.resolver.blockList, ...blockList];
  }
} else {
  config.resolver.blockList = blockList;
}

module.exports = config;
