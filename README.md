# `enhanced` http-proxy-to-socks

![Node.js CI](https://github.com/Soontao/http-proxy-to-socks/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/http-proxy-to-socks/branch/master/graph/badge.svg)](https://codecov.io/gh/Soontao/http-proxy-to-socks)

This is a **forked** project of the original `http-proxy-to-socks` project.

It will use directly local http proxy when the `http request targeted server` is located at china mainland (using [china_ip_list](https://github.com/17mon/china_ip_list/blob/master/china_ip_list.txt)).

Additional, add cluster support.

![](https://res.cloudinary.com/digf90pwi/image/upload/v1589098842/http-proxy-to-socks_hpkkke.png)

## Usage

```bash
docker run --restart=always -d -p 18080:18080 -e SOCKS_SERVER=192.168.3.88:10080 --name htps theosun/htps:latest
```

The `192.168.3.88:10080` is the socks5 server `host and port`.

The `18080` is the http proxy default port, you can use docker expose it as another port.

## CONTRIBUTE

Please add more tests for corresponding features when you send a PR:

```
npm run test
```

## [License](./LICENSE.md)
