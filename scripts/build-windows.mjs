import { build, Platform, Arch } from 'electron-builder';

const requested = process.argv[2];
if (requested && !['portable', 'nsis'].includes(requested)) throw new Error('Expected portable or nsis.');
const targets = requested ? [requested] : ['portable', 'nsis'];
// Electron 43 is the last series with Windows ia32 binaries.
for (const [label, arch, electronVersion] of [['x64', Arch.x64, '44.3.0'], ['x86', Arch.ia32, '43.8.3']]) {
  await build({
    targets: Platform.WINDOWS.createTarget(targets, arch),
    publish: 'never',
    config: {
      electronVersion,
      directories: { output: `release/${label}` },
      portable: { artifactName: `Untrace-Desktop-\${version}-portable-${label}.exe` },
      nsis: { artifactName: `Untrace-Desktop-\${version}-setup-${label}.exe` },
    },
  });
}
