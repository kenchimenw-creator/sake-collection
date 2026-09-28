# CLAUDE.md

お酒コレクション管理アプリ（`index.html` 1ファイル＋`sw.js`、GitHub Pages で公開、データは Firebase）のリポジトリです。
アプリの仕組みは README.md を参照してください。

---

## 銘柄の登録作業（imports/）

ユーザーが「銘柄名と購入情報」を伝えたら、以下の手順で登録データ（JSON）を作成します。
アプリは起動時・開き直したときに `imports/index.json` を読み、未取り込みのファイルを取り込みます（No. はアプリが採番）。

### 基本ルール

- **時刻の基準はタイ時間（Asia/Bangkok）**。ファイル名の日時・「今年」の判定に使う
  - 現在時刻：`TZ=Asia/Bangkok date +%Y%m%d-%H%M`
- **写真は扱わない**（ユーザーが実物を撮影してアプリで追加する）。`photos` は常に空配列
- **ユーザーの申告どおりにする項目**：購入日（`purchaseDate`）・金額（`priceTHB`）・購入店（`shop`）・状態（`status`）
  - 年の指定がない購入日は今年（タイ時間）とする
  - 状態の申告がなければ「未開栓」
- **Web 検索で調べて埋める項目**：
  - `brand`（蒸留所・醸造所・メーカー）
  - `category`・`subCategory`（例：ウイスキー／シングルモルト）
  - `country`・`region`（産地・地域）
  - `abv`（アルコール度数、数値）
  - `memo`（特徴を2文程度。情報源の文章を写さず、自分の言葉で要約する）
- **内容量（`volumeMl`）**：申告があればその値。なければ Web で調べた標準の容量を入れる
  - **タイでは同じ銘柄で 700ml／750ml／1L が流通していることが多い。申告がなく容量違いが存在する場合は、必ずユーザーに確認する**
- `name` は正式な銘柄名（ラベル表記に近いもの）。`rating` は 0（未評価）

### 使ってよい値（index.html の定数に合わせる）

- `category` は `CATEGORIES`、`status` は `STATUSES` の値のみ使用する
  - バーボンは `category` を「バーボン」にする（「ウイスキー」にしない）。`subCategory` は空欄、またはストレート・スモールバッチなどの区分
  - テネシーウイスキー（ジャックダニエルなど）も `category` は「バーボン」、`subCategory` は「テネシーウイスキー」
  - それ以外のアメリカンウイスキー（ライ・コーンなど）は「ウイスキー」
- `country` は `DEFAULT_COUNTRIES` の表記に合わせる（スコッチは「スコットランド」、バーボンは「アメリカ」など）
- 最新の値は index.html で確認する：
  `grep -nE "^const (CATEGORIES|STATUSES|DEFAULT_COUNTRIES) =" index.html`

### 必ずユーザーに確認すること

1. **候補が複数ある場合は、ファイルを作る前に確認する**
   - 容量違い（700ml／750ml／1L など）、熟成年数違い（12年／18年、NAS など）、限定版・旧ボトル・度数違いなど
   - 情報源どうしで内容（度数・産地・蒸留所など）が食い違う場合も、食い違いを示して確認する
2. **作成前に登録内容を表形式で見せ、確認を取る**（例）

   | 項目 | 内容 |
   |---|---|
   | 銘柄名 | 響 JAPANESE HARMONY |
   | 購入日 | 2026-09-27 |
   | ブランド | サントリー |
   | 種別／サブ種別 | ウイスキー／ブレンデッド |
   | 原産国／産地 | 日本／大阪府・山梨県 |
   | 容量／度数 | 700ml／43% |
   | 金額／購入店 | ฿3,290／Central Chidlom |
   | 状態 | 未開栓 |
   | メモ | … |

### ファイルの作成と反映

1. 確認が取れたら `imports/` にファイルを保存する
   - ファイル名：`imports/YYYYMMDD-HHMM-<銘柄の英字スラッグ>.json`（日時は作成時のタイ時間）
   - スラッグは英小文字・数字・ハイフンのみ（例：`hibiki-japanese-harmony`、`dassai-45`、`yamazaki-12`）
   - 原則1本につき1ファイル。複数本を伝えられたら本数分のファイルを作る
2. `imports/index.json` の `files` にファイル名を追加する
3. 検証する：`node tools/check-imports.mjs`（エラーが出たら直す。「注意」は内容を確認）
4. コミットして PR を作成し、main にマージする（GitHub Pages への反映には1〜2分かかる）

ファイルの形式（既存の JSON エクスポートと同じ。`no` は付けない）：

```json
{
  "app": "sake-collection",
  "version": 1,
  "source": "claude-code",
  "createdAt": "2026-09-28T14:30:00+07:00",
  "bottles": [
    {
      "purchaseDate": "2026-09-27",
      "name": "響 JAPANESE HARMONY",
      "brand": "サントリー",
      "category": "ウイスキー",
      "subCategory": "ブレンデッド",
      "country": "日本",
      "region": "大阪府・山梨県",
      "volumeMl": 700,
      "abv": 43,
      "priceTHB": 3290,
      "shop": "Central Chidlom",
      "status": "未開栓",
      "rating": 0,
      "memo": "モルトとグレーンを調和させた華やかなブレンデッド。蜂蜜のような甘さと柔らかな余韻が特徴。",
      "photos": []
    }
  ]
}
```

- 数値項目（`volumeMl`・`abv`・`priceTHB`）は数値。わからない場合は `null`（または項目ごと省略）
- 文字列項目（`brand`・`subCategory`・`country`・`region`・`shop`・`memo`）は、わからなければ空文字 `""`（または項目ごと省略）
- 購入日が不明な場合は `purchaseDate` を省略する（アプリの取り込み日で登録される）
- 1ファイルに複数本をまとめてもよい（ユーザーの指示がある場合）。No. は `bottles` の並び順に振られる

### 取り込み済みファイルの片付け

- 取り込み済みのファイルは、次回の作業時に削除してよい（`imports/index.json` からも除く）
- 取り込み済みの記録は Firestore（`users/{uid}/meta/imports`）に残るため、削除しても二重取り込みにはならない
- アプリで取り込まれたかどうかはリポジトリからは分からないため、削除する前に「前回分は取り込み済みか」をユーザーに一言確認する
