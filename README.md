# portkey

サンドボックス化されたコンテナ内で任意個のHTTPサーバーが立ち上がる状況で、単一のゲートウェイポートだけをホストへ公開しておけば、あとはホスト名とポートの組を指定するだけで内部のどのサーバーにも到達できるようにする、単一ポート越しのリバースプロキシ。

詳細な仕様は [docs/spec.md](docs/spec.md)、ドメイン用語は [CONTEXT.md](CONTEXT.md) を参照。

## インストール・実行

npm registryへは公開していないため、GitHubから直接実行する。

```
npx github:backpaper0/portkey
```

## 使い方

起動後、ブラウザで `http://localhost:<ゲートウェイポート>/` (既定 `1541`) を開くとコンソール画面が表示される。ホスト名とポートを入力すると、対応するアップストリームへアクセスするためのURLが生成される。

```
http://<ホスト名>~<ポート>.localhost:<ゲートウェイポート>/...
```

## 設定

| 設定項目 | CLIフラグ | 環境変数 | 既定値 |
|---|---|---|---|
| ゲートウェイポート | `--port` | `PORTKEY_PORT` | `1541` |
| 接続タイムアウト(秒) | `--connect-timeout` | `PORTKEY_CONNECT_TIMEOUT` | `5` |

## 開発

```
npm install
npm run typecheck
npm test
npm run build
```
