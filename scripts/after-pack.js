// electron-builder "afterPack": firma la app con una firma local (ad-hoc, gratis).
// Sin firma válida, macOS en Apple Silicon dice que la app "está dañada" y no la abre.
// Se ejecuta antes de crear el .dmg/.zip, así ambos llevan la app ya firmada.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.platform !== 'darwin') {
    console.warn('  • firma ad-hoc omitida: solo se puede firmar en una Mac');
    return;
  }
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
  console.log('  • firma ad-hoc aplicada: ' + path.basename(app));
};
