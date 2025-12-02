const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const projectRoot = path.resolve(__dirname, '..');
const browserDir = path.join(projectRoot, 'browser');
const websiteDir = path.join(projectRoot, 'vlix_website');
const updatesDir = path.join(websiteDir, 'updates');
const packageJsonPath = path.join(projectRoot, 'package.json');

// Ensure updates directory exists
if (!fs.existsSync(updatesDir)) {
    fs.mkdirSync(updatesDir, { recursive: true });
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Publishing update for version ${version}...`);

// Update app.js with new version
const appJsPath = path.join(browserDir, 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');
const versionRegex = /const APP_VERSION = '.*';/;
if (versionRegex.test(appJsContent)) {
    appJsContent = appJsContent.replace(versionRegex, `const APP_VERSION = '${version}';`);
    fs.writeFileSync(appJsPath, appJsContent);
    console.log(`Updated APP_VERSION in ${appJsPath}`);
} else {
    console.warn('Warning: APP_VERSION constant not found in app.js');
}

// Create zip
const zip = new AdmZip();
zip.addLocalFolder(browserDir);
const zipPath = path.join(updatesDir, 'update.zip');
zip.writeZip(zipPath);
console.log(`Created ${zipPath}`);

// Create version.json
const versionData = {
    version: version,
    url: 'https://vlix.ai/updates/update.zip'
};
const versionJsonPath = path.join(updatesDir, 'version.json');
fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));
console.log(`Created ${versionJsonPath}`);

console.log('Update published successfully!');
