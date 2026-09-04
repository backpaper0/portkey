# `.localhost`サフィックス付きのホスト名をDNS解決に使わない

アップストリーム識別子(`<ホスト名>_<ポート>`)は`Host`ヘッダー上では`<ホスト名>_<ポート>.localhost`という形でブラウザ向けのアドレッシングにのみ使い、portkeyがアップストリームへ実際に接続する際には、この文字列をNode.jsの名前解決(`dns.lookup`/`net.connect`等)にそのまま渡さない。接続先は識別子から抽出した生のホスト名(v1では常に`localhost`)を直接使う。

[`*.localhost`ワイルドカード解決の実環境検証](https://github.com/backpaper0/portkey/issues/10)により、RFC 6761は`*.localhost`のループバック解決をSHOULDレベルでしか規定しておらず、Node.jsの`dns.lookup`はOSの`getaddrinfo`に完全委譲するためAlpine(musl libc)やWindowsでは実際に外部DNSへ問い合わせが飛び得ることが判明した。`<ホスト名>_<ポート>.localhost`という文字列をそのままportkeyの接続処理に渡す実装は、将来ホスト名部分が`localhost`以外の値を取るようになった時点で、実行環境によっては到達不能・タイムアウトを引き起こす。
