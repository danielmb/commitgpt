import fs from 'fs';
import path from 'path';
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  throw new Error('package.json not found');
}
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
  version: string;
};
const version = packageJson.version;
let newVersionSplitted = version.split('.');
const patch = parseInt(newVersionSplitted[2]);

newVersionSplitted[2] = (patch + 1).toString();

const newVersion = newVersionSplitted.join('.');

packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
