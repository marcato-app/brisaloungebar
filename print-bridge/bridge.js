// Ponte de impressão do Brisa — roda o tempo todo no PC ligado nas duas
// Elgin i9 (Bar/Cozinha e Tabacaria) por cabo USB. A cada poucos segundos,
// pergunta pro PDV "tem ticket novo?", imprime o que chegou, e confirma.
//
// Uso:  node bridge.js  (ou npm start)
// Config: copie config.example.json para config.json antes de rodar.

'use strict';
const fs = require('fs');
const path = require('path');
const { makeClient } = require('./lib/api');
const { buildTicket } = require('./lib/ticket');
const { printToWindowsShare } = require('./lib/printer');

const CONFIG_PATH = process.argv[2] || path.join(__dirname, 'config.json');

function log(...args) {
  console.log('[' + new Date().toLocaleTimeString('pt-BR') + ']', ...args);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Não achei o arquivo de configuração: ' + CONFIG_PATH);
    console.error('Copie config.example.json para config.json e preencha os dados antes de rodar.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

const SECTOR_LABEL = { bar_cozinha: 'Bar/Cozinha', tabacaria: 'Tabacaria' };

function ticketTime(createdAt) {
  // created_at vem do banco em UTC ("2026-08-26 20:14:00"); imprime no
  // horário de Brasília independente de como o relógio do Windows está.
  try {
    return new Date(createdAt.replace(' ', 'T') + 'Z')
      .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  } catch (e) {
    return '';
  }
}

async function processSector(client, config, sector) {
  const printerShare = config.printers[sector];
  if (!printerShare) return; // setor sem impressora configurada — ignora de propósito

  let items;
  try {
    items = await client.printQueue(sector);
  } catch (err) {
    log('Erro buscando fila de', sector + ':', err.message);
    return;
  }

  for (const item of items) {
    const ticket = buildTicket({
      sectorLabel: SECTOR_LABEL[sector] || sector,
      tabLabel: item.tab_label,
      name: item.name,
      qty: item.qty,
      waiterName: item.waiter_name,
      note: item.note,
      time: ticketTime(item.created_at),
    }, { stripAccents: !!config.stripAccents, lineWidth: config.lineWidth });

    try {
      await printToWindowsShare(ticket, printerShare);
      await client.markPrinted(item.id);
      log('Impresso [' + SECTOR_LABEL[sector] + ']', item.qty + 'x', item.name, '—', item.tab_label);
    } catch (err) {
      // Não marca como impresso: tenta de novo no próximo ciclo. Se o motivo
      // for papel acabando, isso se resolve sozinho assim que repuserem o
      // rolo — ninguém precisa reiniciar nada.
      log('ERRO imprimindo "' + item.name + '":', err.message);
    }
  }
}

async function tick(client, config) {
  for (const sector of Object.keys(config.printers)) {
    await processSector(client, config, sector);
  }
}

async function main() {
  const config = loadConfig();
  const client = makeClient({ baseUrl: config.baseUrl, username: config.username, password: config.password });

  log('Ponte de impressão iniciada —', config.baseUrl);
  try {
    await client.login();
    log('Login OK como', config.username);
  } catch (err) {
    log('Não consegui logar:', err.message);
    log('Confira usuário e senha em config.json (é um funcionário cadastrado na tela Funcionários do PDV).');
    process.exit(1);
  }

  const interval = config.pollIntervalMs || 4000;
  const run = () => tick(client, config).catch((err) => log('Erro no ciclo:', err.message));
  run();
  setInterval(run, interval);
}

if (require.main === module) {
  main();
}

module.exports = { processSector, tick, ticketTime };
