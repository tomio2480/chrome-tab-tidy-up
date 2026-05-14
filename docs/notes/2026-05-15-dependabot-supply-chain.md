# Dependabot 対応と供給チェーン調査の知見

## 背景

Dependabot PR 5 件（#40〜#44）を処理する際に，供給チェーン攻撃の調査を実施した．
調査の結果，2026-05-11 に発生した TanStack 供給チェーン攻撃（CVE-2026-45321）が
本プロジェクトに影響しないことを確認した．

## 判断

### TanStack CVE-2026-45321 は本プロジェクトに影響なし

攻撃対象は `@tanstack/router` 系 42 パッケージ（84 バージョン）．
公式 postmortem で `@tanstack/virtual` ファミリーは **confirmed-clean** と明記されている．
本プロジェクトが依存する `@tanstack/virtual-core@3.14.0` への被害はない．

### 各 PR の判断根拠

| PR | パッケージ | 判断 | 根拠 |
|---|---|---|---|
| #42 | `typescript-eslint` 8.59.3 | マージ | バージョン番号のみ変更，コード差分なし |
| #44 | vitest 4.1.6 | マージ | バグ修正のみ，`sequential` API 非使用を確認 |
| #40 | jsdom 26→29 | マージ | CSSOM 大規模改修は DOM/CSS 非使用の当プロジェクトに影響なし |
| #41 | actions/checkout 4→6 | マージ | v6 は認証情報を `$RUNNER_TEMP` に隔離しセキュリティが向上 |
| #43 | vite 7→8 | マージ | Rollup→Rolldown 切替だが CI の build step pass で互換性実証済み |

### vite 8 移行の注意点

- `rollupOptions` は非推奨化（将来的に `rolldownOptions` への移行推奨）
- Node.js 20.19+ 推奨だが 20.11.0 でも CI は通過
- `@crxjs/vite-plugin@2.4.0` との互換性は CI 通過で実証済み

## 代替案と棄却理由

| 選択肢 | 棄却理由 |
|---|---|
| vite 8 を見送り v7 に留める | CI の build pass で互換性が確認できたため先送り不要 |
| jsdom を見送り v26 に留める | テストが CSS/DOM 操作を含まないため影響なし |

## Dependabot 複数 PR 連続処理のパターン

### 問題

複数の Dependabot PR を順にマージすると，マージのたびに
`package-lock.json` が更新され，残りの PR がコンフリクトする．

### 対処

コンフリクトした PR に `@dependabot rebase` とコメントすれば
Dependabot が自動でリベースして CI を再実行する．

```
gh pr comment <PR番号> --body "@dependabot rebase"
```

複数件まとめて依頼できる．

```bash
for pr in 40 41 42 43 44; do
  gh pr comment $pr --body "@dependabot rebase"
done
```

### 教訓

マージ可能な PR が複数ある場合，1 件ずつ順番にマージするのは非効率．
全件へのリベース依頼を先に済ませ，CLEAN になった順でマージする方がよい．

## 供給チェーン調査の手順

Dependabot PR 処理時に実施した調査フロー．

1. **CHANGELOG 確認**: `dep-update-handler` (haiku) でリリースノートを要約
2. **供給チェーン検索**: WebSearch でパッケージ名 + "supply chain attack" + 年を検索
3. **npm audit**: `npm audit` で脆弱性スキャン（CI に組み込み済み）
4. **CI 通過確認**: lint・test・build の全ステップ pass を確認してからマージ

## 参照

- PR #40〜#44（Dependabot）
- [Postmortem: TanStack npm supply-chain compromise](https://tanstack.com/blog/npm-supply-chain-compromise-postmortem)
- [CVE-2026-45321](https://cvereports.com/reports/CVE-2026-45321)
