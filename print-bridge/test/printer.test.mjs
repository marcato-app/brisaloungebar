// Testa lib/printer.js com um execFile falso — roda em Linux (este
// ambiente), mas confere exatamente o comando que seria mandado pro
// Windows, e que o arquivo temporário é escrito e depois limpo.
//
// Run: node test/printer.test.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const { printToWindowsShare } = require('../lib/printer.js');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('ok    ' + label); }
  else { fail++; console.log('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

async function main() {
  const buf = Buffer.from([0x1b, 0x40, 0x41, 0x42]); // ESC @ A B, qualquer coisa

  // -------------------------------------------------------------- sucesso
  let capturedArgs = null;
  let tmpPathSeen = null;
  const execOk = (cmd, args, cb) => {
    capturedArgs = { cmd, args };
    tmpPathSeen = args[3]; // ['/c', 'copy', '/b', <arquivo temporário>, <compartilhamento>]
    check('o arquivo temporário existe no disco na hora do copy', fs.existsSync(tmpPathSeen));
    check('o arquivo temporário tem exatamente os bytes do ticket',
      Buffer.compare(fs.readFileSync(tmpPathSeen), buf) === 0);
    cb(null, '', '');
  };

  await printToWindowsShare(buf, '\\\\localhost\\ELGIN_BAR', { execFile: execOk });

  check('chama cmd.exe', capturedArgs.cmd === 'cmd.exe', capturedArgs.cmd);
  check('usa copy /b (cópia binária, sem reinterpretar o conteúdo)',
    capturedArgs.args[0] === '/c' && capturedArgs.args[1] === 'copy' && capturedArgs.args.includes('/b'));
  check('manda pro compartilhamento configurado',
    capturedArgs.args[capturedArgs.args.length - 1] === '\\\\localhost\\ELGIN_BAR');
  check('limpa o arquivo temporário depois', !fs.existsSync(tmpPathSeen));

  // -------------------------------------------------------------- falha
  const execFail = (cmd, args, cb) => cb(new Error('spawn falhou'), '', 'impressora offline');
  let threw = null;
  try {
    await printToWindowsShare(buf, '\\\\localhost\\ELGIN_TABACARIA', { execFile: execFail });
  } catch (e) { threw = e; }
  check('rejeita com mensagem clara quando o copy falha',
    threw && /ELGIN_TABACARIA/.test(threw.message) && /impressora offline/.test(threw.message), threw && threw.message);

  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}

main();
