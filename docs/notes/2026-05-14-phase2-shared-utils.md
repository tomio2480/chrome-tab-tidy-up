# Phase 2 共通ユーティリティ実装の知見

## 背景

- Issue #8〜#11（schemas.ts / storage.ts / urlUtils.ts / tabUtils.ts）を TDD で実装した．
- PR #47 でまとめて実装し，CI 修正を 1 件追加してマージした．

## 判断

### zod v4 の `z.int()` を採用

`z.number().int()` ではなく `z.int()` を使用した．
zod v4 で正式追加されたトップレベル型であり，整数であることが型レベルで明示される．

### `get(null)` による全件取得方式

`getAllTabs()` / `getAllGroups()` は `chrome.storage.local.get(null)` で全件取得後，プレフィックス（`tab:` / `group:`）でフィルタする方式を採用した．

将来的に件数が膨らんだ場合は `meta:tabIds` キーに全 recordId を保持するインデックス方式への移行を検討する．ただし，ダッシュボード開時にのみ呼ばれる処理であり，容量上限（5 MB）に先に当たるため，現時点では問題なし．

### URL 安全性バリデーション: denylist より allowlist

`isSafeUrl()` は `javascript:` を個別に拒否するのではなく，`http:` / `https:` / `chrome:` / `chrome-extension:` のみを許可する allowlist 方式とした．将来的に危険スキームが追加された場合も漏れなく対応できる．

## 代替案と棄却理由

| 選択肢 | 棄却理由 |
|---|---|
| `z.number().int()` | zod v4 では `z.int()` が推奨で意図がより明確 |
| `get(null)` の代わりに別インデックス管理 | storage への書き込みが非トランザクションのため整合性リスクがあり，現スケールでは不要 |
| denylist 方式の URL バリデーション | 危険スキームの列挙漏れが起きやすい |

## CI での詰まり

`async` な mock 関数に `await` が含まれないことで `@typescript-eslint/require-await` が CI で発火した．ローカルの ESLint では `tests/` が対象に含まれていたが見落とした．

対処: `async` を削除して `Promise.resolve()` を明示的に返す形に修正．
再発防止: モック関数は `async` を付けずに `Promise.resolve()` で返す慣習を徹底する．

## 参照

- PR #47
- Issue #8, #9, #10, #11
