const [major, minor] = process.versions.node.split('.').map(Number);

if (major < 20 || (major === 20 && minor < 19)) {
  console.error(`Node.js 20.19.0 or newer is required. Found ${process.version}.`);
  console.error('Run "nvm install" and "nvm use", then try again.');
  process.exit(1);
}
