// Prepara a pasta www/ (o que vai dentro do APK) a partir do index.html do repositório.
// O index.html original NÃO é alterado: as mudanças abaixo são feitas só na cópia.
// Se algum trecho não for encontrado, o script para com erro (assim você nota na hora).
import fs from 'node:fs';
import path from 'node:path';

// ===== Opções =====
const APP_NAME = 'Saxcrafter';
const APP_SLUG = 'saxcrafter';
const TWO_ROW_HEADER = true; // celular: 1ª linha só com o nome do app; o nome do projeto desce para a 2ª. false = como está no site
// ==================

const ROOT = process.cwd();
const WWW = path.join(ROOT, 'www');
const fail = (m) => { console.error('ERRO: ' + m); process.exit(1); };

// ---- Nome do pacote: io.github.<usuario>.saxcrafter (minúsculas, sem hífen) ----
function makeAppId() {
  if (process.env.APP_ID && process.env.APP_ID.trim()) return process.env.APP_ID.trim();
  let owner = (process.env.OWNER || 'meuusuario').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!owner) owner = 'meuusuario';
  if (/^[0-9]/.test(owner)) owner = 'u' + owner;
  return `io.github.${owner}.${APP_SLUG}`;
}
const APP_ID = makeAppId();
if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(APP_ID)) fail('Nome de pacote inválido: ' + APP_ID);

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(path.join(WWW, 'vendor'), { recursive: true });

// ---- Arquivos que vão para o APK ----
for (const f of ['manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon.svg']) {
  if (!fs.existsSync(f)) fail('Arquivo não encontrado na raiz do repositório: ' + f);
  fs.copyFileSync(f, path.join(WWW, f));
}

// ---- VexFlow (partitura em PDF) local: o app funciona sem internet ----
const vexSrc = 'node_modules/vexflow/build/cjs/vexflow.js';
if (!fs.existsSync(vexSrc)) fail('VexFlow não encontrado (rode npm install).');
fs.copyFileSync(vexSrc, path.join(WWW, 'vendor', 'vexflow.js'));

// ---- Ajustes no index.html (só na cópia) ----
let html = fs.readFileSync('index.html', 'utf8');
function replaceOnce(re, to, what) {
  const m = html.match(re);
  if (!m) fail('Trecho não encontrado no index.html: ' + what);
  html = html.replace(re, () => to);
}

// 1) VexFlow local
replaceOnce(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/vexflow@4\.2\.5\/build\/cjs\/vexflow\.js"><\/script>/,
  '<script src="vendor/vexflow.js"></script>', 'VexFlow (CDN)');

// 2) Sem service worker dentro do APK (os arquivos já estão no aparelho)
replaceOnce(/if\('serviceWorker' in navigator\)\{/, 'if(false){', 'registro do service worker');

// 3) Exportar (MIDI, WAV, JSON, PDF): no Android abre a folha "Compartilhar" (salvar em Arquivos/Drive, enviar...)
replaceOnce(
  /function download\(name, blob\)\{\s*const a = document\.createElement\('a'\);\s*a\.href = URL\.createObjectURL\(blob\); a\.download = name;\s*document\.body\.append\(a\); a\.click\(\); a\.remove\(\);\s*setTimeout\(\(\) => URL\.revokeObjectURL\(a\.href\), 2000\);\s*\}/,
  "async function download(name, blob){ const buf = new Uint8Array(await blob.arrayBuffer()); return window.fbSaveFile(name, buf, blob.type || 'application/octet-stream'); }",
  'função download (MIDI, WAV, JSON, PDF)');

// 4) Textos que só fazem sentido no navegador
replaceOnce(/\s*<li><b>Instalar no celular:<\/b>[^\n]*<\/li>/, '', 'dica "Instalar no celular"');
replaceOnce(/A biblioteca fica guardada neste navegador, dentro do aplicativo, e funciona em qualquer aparelho\./,
  'A biblioteca fica guardada dentro do aplicativo, neste aparelho.', 'texto da biblioteca');
replaceOnce(/Este navegador não permite escolher uma pasta \(isso funciona no Chrome e no Edge\)\. Use a biblioteca do aplicativo ou os botões JSON\/Importar\./,
  'Escolher uma pasta não está disponível no app Android. Use a biblioteca do aplicativo ou os botões JSON/Importar.', 'aviso da pasta do dispositivo');

// 5) Ajudas: exportação, esconder a "instalação" (não existe no APK) e área segura
const helper = `
<style>
html{--fb-top:var(--safe-area-inset-top,env(safe-area-inset-top,0px));--fb-bottom:var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px));--fb-left:var(--safe-area-inset-left,env(safe-area-inset-left,0px));--fb-right:var(--safe-area-inset-right,env(safe-area-inset-right,0px));}
body{padding-top:var(--fb-top)!important;padding-bottom:var(--fb-bottom)!important;padding-left:var(--fb-left);padding-right:var(--fb-right);}
#installBtn,#chkBtn,#chkOut{display:none!important;}
.modal{padding:max(12px,var(--fb-top)) max(12px,var(--fb-right)) max(12px,var(--fb-bottom)) max(12px,var(--fb-left))!important;}
#mHelp .sec:has(#chkBtn){display:none!important;}
${TWO_ROW_HEADER ? '@media(max-width:700px){header{flex-wrap:wrap!important;row-gap:4px;}header h1{flex:1 1 0;min-width:0;}#pname{order:3;flex:0 0 100%;max-width:100%;text-align:left;margin-left:0;}}' : ''}
</style>
<script>
window.fbSaveFile=async function(name,bytes,mime){
  var cap=window.Capacitor, P=cap&&cap.Plugins;
  if(cap&&cap.isNativePlatform&&cap.isNativePlatform()&&P&&P.Filesystem&&P.Share){
    try{
      var bin=''; for(var i=0;i<bytes.length;i+=0x8000){ bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000)); }
      var r=await P.Filesystem.writeFile({path:name,data:btoa(bin),directory:'CACHE'});
      await P.Share.share({title:name,url:r.uri,dialogTitle:'Salvar ou enviar o arquivo'});
      return;
    }catch(e){ if(e&&/cancel/i.test(String(e.message||e))) return; console.error(e); }
  }
  var url=URL.createObjectURL(new Blob([bytes],{type:mime}));
  var a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},4000);
};
</script>
<script>
// Garantia extra: no app Android, se o sistema não informar a altura da barra de status, reserva um espaço mínimo no topo.
(function(){
  function fix(){
    try{
      var cap=window.Capacitor; if(!(cap&&cap.isNativePlatform&&cap.isNativePlatform())) return;
      var v=parseFloat(getComputedStyle(document.body).paddingTop)||0;
      if(v<1){ document.documentElement.style.setProperty('--fb-top','28px'); }
    }catch(e){}
  }
  window.addEventListener('load',function(){ setTimeout(fix,700); });
})();
</script>
`;
if (!/<\/head>/.test(html)) fail('</head> não encontrado.');
html = html.replace('</head>', () => helper + '</head>');

fs.writeFileSync(path.join(WWW, 'index.html'), html);

// ---- Configuração do Capacitor ----
const cfg = { appId: APP_ID, appName: APP_NAME, webDir: 'www', backgroundColor: '#0d0a07', android: { allowMixedContent: false } };
fs.writeFileSync('capacitor.config.json', JSON.stringify(cfg, null, 2));

console.log('OK. Pacote: ' + APP_ID + ' | Nome: ' + APP_NAME);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `app_id=${APP_ID}\n`);
