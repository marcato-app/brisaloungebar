// Manda um Buffer cru pra uma impressora compartilhada do Windows.
//
// "copy /b" copia byte a byte, sem o Windows tentar entender o conteúdo como
// texto — é o jeito padrão (e sem precisar instalar nada além do driver que
// já vem com a impressora) de mandar comando ESC/POS puro pra uma
// impressora térmica compartilhada localmente. A impressora só precisa
// estar compartilhada no próprio Windows (Painel de Controle > Dispositivos
// e Impressoras > botão direito na impressora > Propriedades > Compartilhar).

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

function printToWindowsShare(buffer, printerShare, opts) {
  opts = opts || {};
  const run = opts.execFile || execFile;
  const tmpFile = path.join(os.tmpdir(), 'ticket-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.bin');

  return new Promise((resolve, reject) => {
    fs.writeFile(tmpFile, buffer, (writeErr) => {
      if (writeErr) return reject(writeErr);
      run('cmd.exe', ['/c', 'copy', '/b', tmpFile, printerShare], (err, _stdout, stderr) => {
        fs.unlink(tmpFile, () => {}); // limpeza best-effort, não trava o fluxo se falhar
        if (err) return reject(new Error('Falha ao imprimir em ' + printerShare + ': ' + (stderr || err.message)));
        resolve();
      });
    });
  });
}

module.exports = { printToWindowsShare };
