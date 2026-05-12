const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const escapePath = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ignoredPaths = [
  path.join(projectRoot, 'functions', 'node_modules'),
  path.join(projectRoot, 'functions', 'lib'),
];

const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
  ? [config.resolver.blockList]
  : [];

config.resolver.blockList = exclusionList([
  ...existingBlockList,
  ...ignoredPaths.map((ignoredPath) => new RegExp(`^${escapePath(ignoredPath)}\\/.*$`)),
]);

module.exports = config;
