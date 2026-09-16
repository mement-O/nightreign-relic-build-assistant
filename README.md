# Nightreign Relic Build Assistant

セーブデータから遺物を読み込み、プリセット最適化・遺物編成検索・追加スキル検索を行うブラウザツールです。セーブへの書き込みや外部送信は行いません。

## ファイル構成

- `index.html`：画面の構造
- `assets/app.js`：セーブ読込・評価・検索処理
- `assets/ui.js`：分類表示・フィルター表示・スクロール補助
- `assets/styles.css`：画面全体のスタイル
- `data/effect-rule-master.json`：適用範囲・重ね掛け・上限などの正式ルール
- `data/effect-base-master.json`：遺物名・効果名・EffectGroup・ランク
- `data/relic-struct.json`：遺物IDごとの色・通常／深層
- `docs/`：出典・変更根拠・保守メモ

v24ではv23hの実効マスタを通常のJSONへ統合しました。圧縮分割ファイル、実行時のfetch差替え、Blob経由の起動、後付けマスタ補正は不要です。今後は上記ファイルを直接編集します。マスタの値はv23hと同一です。

開発時はこのディレクトリをHTTPサーバーで配信してください。`file://`ではJSON読込が動作しません。公開先はGitHub Pagesです。

旧版はGit履歴から復元できます。整理前の基準コミット：`f937993a18b62f1dafae15b65a7695bda6f8274e`（v23h）。
