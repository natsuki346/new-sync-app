# アーカイブコードの復活手順

このリポジトリには、将来必要になった時のために
一時的にmainから削除したコードを保管するアーカイブブランチがあります。

## アーカイブブランチ一覧

### 1. feature/search-ui-archive

**内容**: イベント一覧・広告枠を含む旧Search画面UI  
**アーカイブ日**: 2026-04-17  
**復活タイミング**: 広告クライアント獲得後、またはイベント情報を
Search画面に戻したい時

### 2. feature/event-payment-infra-archive

**内容**: イベント申込・支払い・履歴・主催者詳細の全UI
- src/app/payment/ （支払い方法選択画面）
- src/app/history/ （申込履歴・チケットQR）
- src/app/organizer/[id]/ （主催者詳細）
- src/app/search/[id]/ （イベント詳細）
- src/lib/mockData.ts の INFO_EVENTS, ORGANIZERS
- src/app/settings/page.tsx の「💳 支払い方法」リンク

**アーカイブ日**: 2026-04-17  
**復活タイミング**: イベント主催クライアント獲得後

---

## 復活方法

### ケース1: イベント・支払い機能を全部戻す

```bash
cd C:/Users/81908/sync-v5

git checkout main
git pull origin main

git checkout feature/event-payment-infra-archive -- src/app/payment
git checkout feature/event-payment-infra-archive -- src/app/history
git checkout feature/event-payment-infra-archive -- src/app/organizer
git checkout feature/event-payment-infra-archive -- src/app/search/[id]
git checkout feature/event-payment-infra-archive -- src/lib/mockData.ts

# Settings画面の支払いリンクは手動で復活
# 参考: https://github.com/natsuki346/new-sync-app/blob/feature/event-payment-infra-archive/src/app/settings/page.tsx

git status
git add .
git commit -m "feat: restore event/payment infrastructure from archive"
git push origin main
```

### ケース2: 支払い画面だけ復活させる

```bash
git checkout feature/event-payment-infra-archive -- src/app/payment
git add .
git commit -m "feat: restore payment page"
git push origin main
```

### ケース3: 旧Search画面UIに戻す

```bash
git checkout feature/search-ui-archive -- src/app/search
git add .
git commit -m "feat: restore old search UI with event list"
git push origin main
```

### ケース4: 中身を見るだけ（復活させない）

**GitHub上で閲覧（推奨）**:
- https://github.com/natsuki346/new-sync-app/tree/feature/event-payment-infra-archive
- https://github.com/natsuki346/new-sync-app/tree/feature/search-ui-archive

---

## コマンド解説

`git checkout <ブランチ名> -- <ファイルパス>`

**重要**: `--` の後にファイルパスを書く。これを忘れると
ブランチ切り替えになってしまう。

---

## 注意事項

### やってはいけないこと
- ❌ アーカイブブランチを削除する
- ❌ アーカイブブランチに直接上書きコミット
- ❌ mainブランチで `git reset --hard` で過去に戻す

### 推奨事項
- ✅ GitHubの Branch Protection を有効化
- ✅ 復活前に `git pull origin main` でmainを最新に
- ✅ 復活後は動作確認してからpush

---

## 復活時に必要な追加作業

削除した機能を復活させる時、以下も対応が必要：

### DB設計
- `events` テーブル（イベント情報）
- `event_participants` テーブル（申込者）
- `payments` テーブル（決済履歴）
- `tickets` テーブル（チケット情報）

### 決済基盤
- Stripe / PayPay / コンビニ決済のAPI統合
- 環境変数の追加

### モックデータ → 実データ連携
- アーカイブされたコードはmockData依存
- 復活後はSupabase連携への書き換えが必要
