# chrome-tab-tidy-up 実装計画

Chrome / Edge 向けブラウザ拡張機能の実装計画書．
タブの初回オープン時刻・最終更新時刻の記録，専用タブによる一覧・絞り込み・重複検出を扱う．
ブラウザのタブグループとの双方向同期や，閉じたタブのブックマーク的保持にも対応する．

---

## 目次

1. [リポジトリ情報](#1-リポジトリ情報)
2. [対象ブラウザと API 互換性](#2-対象ブラウザと-api-互換性)
3. [技術スタック](#3-技術スタック)
4. [ディレクトリ構成](#4-ディレクトリ構成)
5. [機能一覧](#5-機能一覧)
6. [データ設計](#6-データ設計)
7. [タブグループ同期設計](#7-タブグループ同期設計)
8. [閉じたタブの管理](#8-閉じたタブの管理)
9. [セキュリティ設計](#9-セキュリティ設計)
10. [実装フェーズと Issue 分解](#10-実装フェーズと-issue-分解)
11. [テスト方針](#11-テスト方針)
12. [Lint / 静的解析](#12-lint--静的解析)
13. [CI 設計](#13-ci-設計)
14. [将来対応（スコープ外）](#14-将来対応スコープ外)

---

## 1. リポジトリ情報

| 項目 | 内容 |
|---|---|
| リポジトリ名 | `chrome-tab-tidy-up` |
| ライセンス | MIT |
| 対象ブラウザ | Chrome / Edge（Manifest V3） |
| 配布形態 | 個人利用（ストア非公開） |

---

## 2. 対象ブラウザと API 互換性

Edge は Chromium ベースのため，本拡張機能で使用する `chrome.*` API はそのまま動作する．
ビルド成果物も同一のものが両ブラウザで利用可能である．

### 使用する主要 API

| API | 用途 |
|---|---|
| `chrome.tabs` | タブ一覧取得・イベント監視・操作 |
| `chrome.tabGroups` | ネイティブタブグループの取得・更新 |
| `chrome.storage.local` | データ永続化 |

### スリープ中タブの扱い

Chrome の Memory Saver と Edge の Sleeping Tabs で休止中のタブは，`discarded` フラグで識別できる．
通常の `chrome.tabs.query` で取得できるため，特別な API は不要．
UI 上で「スリープ中」のバッジを表示する．

---

## 3. 技術スタック

| 層 | 技術 | バージョン目安 | 採用理由 |
|---|---|---|---|
| 言語 | TypeScript（strict） | 6.x | 型安全・補完 |
| バンドラ | Vite + `@crxjs/vite-plugin` | Vite 7.x | 拡張機能向け設定が簡潔，HMR 対応 |
| UI | Preact + Signals | 10.x | React 互換で約 3KB，再レンダリング最小 |
| 仮想スクロール | TanStack Virtual | 3.x | 大量タブ時の DOM ノード数抑制 |
| スキーマ検証 | zod | 4.x | ストレージデータのバリデーション |
| データ永続化 | `chrome.storage.local` | — | Service Worker 再起動後も保持 |
| Lint | ESLint + Prettier | — | コード品質の均一化 |
| テスト | Vitest（jsdom 環境） | 4.x | Vite 統合，拡張機能ロジックの単体テスト |

---

## 4. ディレクトリ構成

```
chrome-tab-tidy-up/
├── src/
│   ├── background/
│   │   ├── service-worker.ts         # エントリポイント
│   │   ├── handlers/
│   │   │   ├── tabHandlers.ts        # タブイベント処理
│   │   │   └── groupHandlers.ts      # タブグループイベント処理
│   │   └── sync/
│   │       └── groupSync.ts          # グループ同期ロジック
│   ├── dashboard/
│   │   ├── index.html                # 専用タブのエントリポイント
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── GroupList.tsx         # グループ一覧（左ペイン等）
│   │   │   ├── GroupSection.tsx      # 個別グループセクション
│   │   │   ├── TabList.tsx           # 仮想スクロール一覧
│   │   │   ├── TabItem.tsx           # 各行
│   │   │   ├── FilterBar.tsx         # 日時・URL フィルタ
│   │   │   ├── ContextMenu.tsx       # カスタム右クリックメニュー
│   │   │   └── AddTabDialog.tsx      # 「+」ボタンの URL 入力ダイアログ
│   │   └── hooks/
│   │       ├── useTabs.ts            # 開・スリープ中のタブ取得
│   │       ├── useClosedTabs.ts      # 閉じたタブ取得
│   │       ├── useGroups.ts          # グループ取得
│   │       └── useFilter.ts          # フィルタ状態管理
│   ├── shared/
│   │   ├── types.ts                  # 共有型定義
│   │   ├── schemas.ts                # zod スキーマ
│   │   ├── storage.ts                # storage.local の読み書きラッパー
│   │   ├── tabUtils.ts               # 重複検出などのユーティリティ
│   │   ├── urlUtils.ts               # URL 安全性チェック
│   │   └── titleFetcher.ts           # 閉じたタブ追加時のタイトル取得
│   └── manifest.json
├── tests/
│   ├── storage.test.ts
│   ├── schemas.test.ts
│   ├── tabUtils.test.ts
│   ├── urlUtils.test.ts
│   ├── useFilter.test.ts
│   ├── groupSync.test.ts
│   └── titleFetcher.test.ts
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── vite.config.ts
├── LICENSE
└── README.md
```

---

## 5. 機能一覧

### 5-1. バックグラウンド（Service Worker）

| 機能 | トリガー | 処理 |
|---|---|---|
| 初回オープン時刻の記録 | `chrome.tabs.onCreated` | 安定 ID を発行し，現在時刻を `firstOpened` として保存 |
| 最終更新時刻の記録 | `chrome.tabs.onUpdated`（`status === 'complete'`） | `lastRefreshed` を現在時刻で上書き |
| タブ削除時の処理 | `chrome.tabs.onRemoved` | グループ所属に応じて閉じたタブとして保持 or 削除 |
| グループ作成の同期 | `chrome.tabGroups.onCreated` | 拡張機能内グループを生成 |
| グループ更新の同期 | `chrome.tabGroups.onUpdated` | タイトル・色を反映 |
| グループ削除の同期 | `chrome.tabGroups.onRemoved` | 拡張機能内グループとそれに属する閉じたタブをまとめて破棄 |
| タブのグループ移動 | `chrome.tabs.onUpdated`（`groupId` 変化） | 拡張機能内データの所属グループを更新 |

### 5-2. ダッシュボード（専用タブ）

| 機能 | 詳細 |
|---|---|
| タブ一覧表示 | 開いている・スリープ中・閉じたタブを混在表示，仮想スクロール |
| グループ別表示 | グループごとにセクション化して表示 |
| 状態バッジ | 各タブに「開」「スリープ」「閉」のバッジを表示 |
| タブ名クリック | 開・スリープ：そのタブをアクティブにする / 閉：新しいタブとして開く |
| ×ボタン | 開・スリープ：`chrome.tabs.remove` / 閉：拡張機能内データを削除 |
| 重複 URL ハイライト | 同一 URL のタブが 2 件以上の場合，行をハイライト |
| 右クリックメニュー（重複） | 重複タブ行で「このタブ以外の重複を閉じる」を表示 |
| グループへの「+」ボタン | URL 入力 → バックグラウンドでタイトル取得 → 閉じたタブとしてグループに追加 |
| グループ削除 | 拡張機能内のグループ削除（ブラウザ側にも反映） |
| 日時絞り込み | 初回オープン日時・最終更新日時それぞれで期間フィルタ |
| URL 絞り込み | URL またはタブ名のテキストフィルタ |

---

## 6. データ設計

### 6-1. 設計方針

`tabId` はブラウザ再起動やタブ閉じ後に再利用される可能性がある．
そのため拡張機能内では **独自の安定 ID（`recordId`，UUID v4）** を主キーとして使用する．
`tabId` は開いているタブとの紐付けにのみ使う．

ブラウザのタブグループ ID（`groupId`）は，
グループが存在する間は安定しているため，そのまま使用する．

### 6-2. 型定義

```typescript
// shared/types.ts

/** タブの状態 */
export type TabState = 'open' | 'discarded' | 'closed';

/** タブレコード（開・スリープ・閉のすべてを表現） */
export interface TabRecord {
  recordId: string;        // UUID v4，主キー
  tabId: number | null;    // 開いているとき・スリープ中のみ．閉じたら null
  url: string;
  title: string;
  firstOpened: number;     // Unix タイムスタンプ（ms）
  lastRefreshed: number;   // Unix タイムスタンプ（ms）
  state: TabState;
  groupId: number | null;  // ブラウザのタブグループ ID．所属しなければ null
  windowId: number | null; // 開・スリープのみ
}

/** グループレコード */
export interface GroupRecord {
  groupId: number;         // ブラウザのタブグループ ID
  title: string;
  color: chrome.tabGroups.ColorEnum;
  createdAt: number;
}
```

### 6-3. ストレージキー設計

| キー | 値 | 用途 |
|---|---|---|
| `tab:{recordId}` | `TabRecord` | 個別タブレコード |
| `group:{groupId}` | `GroupRecord` | 個別グループレコード |
| `index:tabId:{tabId}` | `recordId` | 開いているタブ ID から `recordId` を引く逆引き |

逆引きインデックスにより，`onUpdated` などのイベントで `tabId` から
該当レコードを O(1) で取得できる．

---

## 7. タブグループ同期設計

### 7-1. 同期方針

| 項目 | 仕様 |
|---|---|
| 1 タブ 1 グループ | ネイティブの仕様に準拠 |
| 開・スリープ中のタブ | ブラウザ側と双方向同期 |
| 閉じたタブ | 拡張機能内のみ．ブラウザには存在しない |
| 拡張機能内のみのグループ | 作成不可（ブラウザ側のタブグループと 1:1 対応のみ） |
| ブラウザ側でグループ削除 | 拡張機能内のグループも，それに属する閉じたタブも，まとめて破棄 |

### 7-2. 同期イベントマトリクス

ブラウザ側のイベントに対する拡張機能の動作を表 1 に示す．

**表 1：ブラウザ側イベントと拡張機能の同期動作**

| ブラウザ側イベント | 拡張機能の動作 |
|---|---|
| グループ作成 | `GroupRecord` を新規作成 |
| グループ名・色変更 | `GroupRecord` を更新 |
| グループ削除 | `GroupRecord` と所属閉じたタブをすべて削除 |
| タブをグループに追加 | 該当 `TabRecord.groupId` を更新 |
| タブをグループから外す | 該当 `TabRecord.groupId` を `null` に更新 |
| タブを別グループへ移動 | 該当 `TabRecord.groupId` を新グループ ID に更新 |

### 7-3. 拡張機能側からブラウザへの操作

拡張機能 UI からの操作は限定的とする．

| 拡張機能側の操作 | ブラウザへの反映 |
|---|---|
| グループ削除 | `chrome.tabGroups` には直接削除 API がないため，所属する開・スリープ中のタブを取得し `chrome.tabs.ungroup` で全て解除する |
| 閉じたタブの削除 | ブラウザ側へは反映なし（拡張機能内のみ） |

---

## 8. 閉じたタブの管理

### 8-1. 閉じたタブの保持条件

タブが閉じられた（`onRemoved`）際の処理は所属グループによって分岐する．

| タブの所属 | `onRemoved` 時の処理 |
|---|---|
| グループに所属していた | `state` を `'closed'` に，`tabId` を `null` に更新して保持 |
| グループに所属していなかった | レコードを完全に削除 |

つまり「閉じたタブのブックマーク的保持」はグループに所属していたタブのみが対象である．

### 8-2. 「+」ボタンによる閉じたタブの追加

グループのヘッダにある「+」ボタンを押した際のフローは以下の通り．

1. URL 入力ダイアログを表示
2. ユーザーが URL を確定
3. URL の安全性検証（`isSafeUrl`）
4. バックグラウンドで `chrome.tabs.create({ url, active: false })` で開く
5. `onUpdated`（`status === 'complete'`）でタイトルを取得
6. `chrome.tabs.remove` でタブを閉じる
7. 取得したタイトルで `TabRecord`（`state: 'closed'`）を作成し，対象グループに紐付け

タイトル取得失敗時（タイムアウト・404 等）は URL のみで保存する（タイトル＝URL）．
タイムアウトは 10 秒とする．

### 8-3. 閉じたタブを開く操作

| 操作 | 処理 |
|---|---|
| 閉じたタブのタイトルクリック | `chrome.tabs.create({ url })` で新しいタブとして開く．閉じたタブのレコードはそのまま残す |

ここで「開いた瞬間に閉じたタブレコードを削除しない」のは，
ユーザーが意図的に「あとで読む」用途で保持している可能性が高いため．

---

## 9. セキュリティ設計

### 9-1. パーミッションの最小化

`manifest.json` で宣言するパーミッションは以下のみとする．

| パーミッション | 用途 |
|---|---|
| `tabs` | タブ一覧の取得・イベント監視・操作 |
| `tabGroups` | タブグループの取得・操作 |
| `storage` | `chrome.storage.local` への読み書き |

`host_permissions` は宣言しない．
タブの URL は `tabs` パーミッションで取得できる．

### 9-2. Content Security Policy（CSP）

Manifest V3 では `manifest.json` の `content_security_policy` が CSP の正規設定場所である．
HTML の `<meta>` タグによる CSP は拡張機能ページでは無視されるため，`manifest.json` で管理する．

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self';"
}
```

`eval` および inline スクリプト・inline スタイルは使用禁止とする．
Vite のビルド設定で inline 出力を無効化する．

### 9-3. XSS 対策（タブ URL・タイトルの表示）

タブの URL とタイトルはユーザーが制御できる外部入力であるため，以下を徹底する．

- Preact のテンプレートは基本的に自動エスケープされるが，`dangerouslySetInnerHTML` の使用を禁止
- ESLint ルール `no-danger` を有効化し，CI で検出
- URL を `<a>` タグや `chrome.tabs.create` へ渡す前に `javascript:` スキーム等を排除

```typescript
// 例：javascript: スキームの排除
const isSafeUrl = (url: string): boolean =>
  /^https?:\/\//.test(url) || url.startsWith('chrome://') || url.startsWith('edge://');
```

「+」ボタンでの URL 入力は特に厳格に検証する．

### 9-4. ストレージデータのバリデーション

`chrome.storage.local` から読み込んだデータは zod スキーマで検証する．
バリデーション失敗時は該当レコードをスキップし，エラーログを出力する．

```typescript
// 例
import { z } from 'zod';

export const TabRecordSchema = z.object({
  recordId: z.string().uuid(),
  tabId: z.number().nullable(),
  url: z.string(),
  title: z.string(),
  firstOpened: z.number(),
  lastRefreshed: z.number(),
  state: z.enum(['open', 'discarded', 'closed']),
  groupId: z.number().nullable(),
  windowId: z.number().nullable(),
});
```

### 9-5. タブ操作の安全な呼び出し

`chrome.tabs.remove` および `chrome.tabs.update` を呼び出す前に，対象タブの実在確認を行う．

```typescript
const tab = await chrome.tabs.get(tabId).catch(() => null);
if (tab === null) return; // 既に閉じられている場合は何もしない
await chrome.tabs.remove(tabId);
```

複数タブの一括削除（重複タブ閉じる）でも 1 件ずつ存在確認してから削除する．

### 9-6. 「+」ボタンのタイトル取得時の安全性

タイトル取得用に開くタブは `active: false` で背面に開き，
タイトル取得後は速やかに閉じる．
ユーザーが意図せず悪意あるサイトと長くインタラクションしないよう，
タイムアウト（10 秒）を必ず設定する．

### 9-7. 依存ライブラリの脆弱性管理

- `npm audit` を CI に組み込み，critical 以上の脆弱性がある場合はビルドを失敗させる
- Dependabot を有効化し，定期的な依存更新を自動化する

---

## 10. 実装フェーズと Issue 分解

### Phase 1: プロジェクト基盤

| Issue | タイトル | 内容 |
|---|---|---|
| #1 | リポジトリ初期化 | Vite + crxjs + Preact + TypeScript のセットアップ |
| #2 | ESLint / Prettier 設定 | strict ルール，import 順序，`no-danger` ルールの設定 |
| #3 | Vitest セットアップ | テスト実行環境の整備 |
| #4 | manifest.json 作成 | Manifest V3，`tabs`・`tabGroups`・`storage` のみ宣言 |
| #5 | CSP 設定 | `manifest.json` の `content_security_policy` に CSP を追加，HTML meta タグは削除 |
| #6 | Dependabot 設定 | 依存ライブラリの自動更新設定 |

### Phase 2: 共通基盤（型・スキーマ・ユーティリティ）

| Issue | タイトル | 内容 |
|---|---|---|
| #7 | 型定義（`types.ts`） | `TabRecord`・`GroupRecord` の定義 |
| #8 | zod スキーマ（`schemas.ts`） | バリデーションスキーマと境界値テスト |
| #9 | ストレージラッパー（`storage.ts`） | キー構造に基づく CRUD・逆引き，バリデーション込み |
| #10 | URL 安全性バリデーション（`urlUtils.ts`） | `javascript:` スキーム排除の実装とテスト |
| #11 | 重複検出ユーティリティ（`tabUtils.ts`） | 開・スリープ中タブの URL 重複グループ化 |

### Phase 3: Service Worker（タブイベント）

| Issue | タイトル | 内容 |
|---|---|---|
| #12 | `onCreated` ハンドラ | 安定 ID 発行，初回オープン時刻記録 |
| #13 | `onUpdated` ハンドラ | 最終更新時刻・URL・タイトル・状態（discarded）の同期 |
| #14 | `onRemoved` ハンドラ | グループ所属に応じた分岐（閉じたタブ化 or 削除） |

### Phase 4: Service Worker（グループ同期）

| Issue | タイトル | 内容 |
|---|---|---|
| #15 | `tabGroups.onCreated` ハンドラ | `GroupRecord` 新規作成 |
| #16 | `tabGroups.onUpdated` ハンドラ | タイトル・色の反映 |
| #17 | `tabGroups.onRemoved` ハンドラ | `GroupRecord` と所属閉じたタブの一括削除 |
| #18 | タブのグループ移動同期 | `tabs.onUpdated` の `groupId` 変化を検出してレコード更新 |
| #19 | グループ同期ロジックの統合テスト | 一連のシナリオ（作成 → タブ追加 → 削除）のテスト |

### Phase 5: タイトル取得機能

| Issue | タイトル | 内容 |
|---|---|---|
| #20 | `titleFetcher.ts` | バックグラウンドで開いてタイトル取得し閉じる関数（タイムアウト付き） |
| #21 | タイトル取得失敗時のフォールバック | URL のみで保存するロジック |

### Phase 6: ダッシュボード UI

| Issue | タイトル | 内容 |
|---|---|---|
| #22 | `useTabs` フック | 開・スリープ中のタブ取得，`storage.onChanged` でリアルタイム反映 |
| #23 | `useClosedTabs` フック | 閉じたタブ取得 |
| #24 | `useGroups` フック | グループ一覧取得 |
| #25 | `FilterBar` コンポーネント | テキスト・日時フィルタの UI と状態 |
| #26 | `useFilter` フック | フィルタロジックの実装とテスト |
| #27 | `TabItem` コンポーネント | タブ行（状態バッジ・クリック・×ボタン・重複ハイライト） |
| #28 | `ContextMenu` コンポーネント | カスタム右クリックメニューの表示・非表示制御 |
| #29 | 「このタブ以外の重複を閉じる」処理 | 存在確認付きの重複タブ一括削除ロジック |
| #30 | `TabList` コンポーネント | TanStack Virtual による仮想スクロール一覧 |
| #31 | `GroupSection` コンポーネント | グループ単位のセクション，「+」ボタン・グループ削除ボタン |
| #32 | `AddTabDialog` コンポーネント | URL 入力ダイアログ（バリデーション込み） |
| #33 | グループ削除処理 | `chrome.tabs.ungroup` 呼び出しと拡張機能内データ削除 |
| #34 | `App.tsx` 統合 | 各コンポーネントの組み合わせと動作確認 |

### Phase 7: 仕上げ

| Issue | タイトル | 内容 |
|---|---|---|
| #35 | README 作成 | インストール手順・使い方 |
| #36 | 手動動作確認 | Chrome / Edge それぞれでの最終確認 |

---

## 11. テスト方針

- テストファースト TDD で実装する（t-wada 提唱）
- ロジックは純粋関数として切り出し，単体テストで仕様を固める
- `chrome.*` API はモックで代替する（`vitest` の `vi.mock`）
- zod バリデーションの境界値テスト（不正データ・欠損フィールド）を必ず含める
- `isSafeUrl` 関数は `javascript:` スキームの各種変形（大文字・空白混入等）を網羅したテストケースを用意する
- グループ同期は単体テストに加え，シナリオベースの統合テストを書く（Phase 4 の Issue #19）
- UI コンポーネントのテストは Phase 6 完了後に E2E として別途検討

---

## 12. Lint / 静的解析

```jsonc
// tsconfig.json（抜粋）
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- ESLint：`@typescript-eslint/recommended` を採用する．
- XSS 対策：`dangerouslySetInnerHTML` 禁止（`no-restricted-syntax`）
- Prettier：セミコロンなし，シングルクォート，幅 100

---

## 13. CI 設計

GitHub Actions で以下を自動実行する．パーミッションは最小（`contents: read`）．

```
on: [push, pull_request]

jobs:
  ci:
    steps:
      - checkout
      - setup Node.js
      - install dependencies
      - npm audit（critical 以上で失敗）
      - lint（ESLint + tsc --noEmit）
      - test（Vitest）
      - build（Vite）
```

ビルド成果物（`dist/`）は Actions の Artifact としてアップロードし，手動でインストール可能にする．

---

## 14. 将来対応（スコープ外）

- Chrome Web Store への公開（プライバシーポリシー・ストア素材・申請ワークフロー含む）
- Firefox 対応（WebExtensions API に寄せれば移植可能）
- タブのスナップショット履歴（時系列でのタブ状態の記録）
- セッション（ウィンドウ単位）でのグループ表示
- タグ機能（グループとは別軸での分類）
