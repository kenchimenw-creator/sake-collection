// imports/ の登録データを検証する（Claude Code が作成後に実行する）
//   node tools/check-imports.mjs
// index.html の CATEGORIES・STATUSES・DEFAULT_COUNTRIES を読み取り、
// imports/index.json と各ファイルの形式・値をチェックする。エラーがあれば終了コード 1
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const readConst = (name) => {
  const m = new RegExp(`const ${name} = (\\[[^\\]]*\\]);`).exec(html);
  if (!m) throw new Error(`index.html に ${name} が見つかりません`);
  return Function(`return ${m[1]};`)();
};
const CATEGORIES = readConst('CATEGORIES');
const STATUSES = readConst('STATUSES');
const COUNTRIES = readConst('DEFAULT_COUNTRIES');

const errors = [];
const warns = [];
const dir = path.join(root, 'imports');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
if (!Array.isArray(index.files)) errors.push('index.json: files が配列ではありません');
const files = index.files || [];
if (new Set(files).size !== files.length) errors.push('index.json: 同じファイル名が重複しています');

const NAME_RE = /^\d{8}-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

for (const name of files) {
  const e = (msg) => errors.push(`${name}: ${msg}`);
  if (!NAME_RE.test(name)) e('ファイル名は YYYYMMDD-HHMM-<英小文字・数字・ハイフンのスラッグ>.json にしてください');
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) { e('ファイルがありません'); continue; }
  let data;
  try { data = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) { e(`JSON として読めません（${err.message}）`); continue; }
  if (data.app !== 'sake-collection') e('app は "sake-collection" にしてください');
  if (data.version !== 1) e('version は 1 にしてください');
  if (!Array.isArray(data.bottles) || !data.bottles.length) { e('bottles が空です'); continue; }
  data.bottles.forEach((b, i) => {
    const be = (msg) => e(`bottles[${i}] ${msg}`);
    if ('no' in b) be('no は付けないでください');
    if (!Array.isArray(b.photos) || b.photos.length) be('photos は空配列にしてください');
    if (!b.name || typeof b.name !== 'string') be('name がありません');
    // 購入日が不明なら省略可（アプリの取り込み日で登録される）
    if (b.purchaseDate !== undefined && !YMD_RE.test(b.purchaseDate)) be('purchaseDate は YYYY-MM-DD にしてください（不明なら項目ごと省略）');
    if (!CATEGORIES.includes(b.category)) be(`category「${b.category}」は ${CATEGORIES.join('／')} のいずれかにしてください`);
    if (!STATUSES.includes(b.status)) be(`status「${b.status}」は ${STATUSES.join('／')} のいずれかにしてください`);
    if (b.country && !COUNTRIES.includes(b.country)) warns.push(`${name}: bottles[${i}] country「${b.country}」は DEFAULT_COUNTRIES にない表記です（意図どおりか確認）`);
    // 空欄の項目は省略してよい（アプリ側で空欄として扱う）。値がある場合は型をチェック
    for (const k of ['volumeMl', 'abv', 'priceTHB']) if (b[k] !== undefined && !isNum(b[k])) be(`${k} は数値（または null）にしてください`);
    if (!(Number.isInteger(b.rating) && b.rating >= 0 && b.rating <= 5)) be('rating は 0〜5 の整数にしてください');
    for (const k of ['brand', 'subCategory', 'country', 'region', 'shop', 'memo']) if (b[k] !== undefined && typeof b[k] !== 'string') be(`${k} は文字列にしてください`);
  });
}
for (const f of fs.readdirSync(dir)) {
  if (f !== 'index.json' && f.endsWith('.json') && !files.includes(f)) warns.push(`${f}: index.json に載っていません（アプリに取り込まれません）`);
}

warns.forEach((w) => console.log('注意:', w));
errors.forEach((m) => console.log('エラー:', m));
console.log(errors.length ? `\n${errors.length}件のエラーがあります` : `OK（${files.length}ファイル）`);
process.exit(errors.length ? 1 : 0);
