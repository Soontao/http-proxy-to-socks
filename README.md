# `enhanced` http-proxy-to-socks

![Node.js CI](https://github.com/Soontao/http-proxy-to-socks/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/Soontao/http-proxy-to-socks/branch/master/graph/badge.svg)](https://codecov.io/gh/Soontao/http-proxy-to-socks)
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/theosun/htps)](https://hub.docker.com/r/theosun/htps)

This is a **forked** project of the original `http-proxy-to-socks` project.

* When the server is located in `mainland China`, the traffic data will be directly transferred between the client and the server (using [china_ip_list](https://github.com/17mon/china_ip_list/blob/master/china_ip_list.txt)).
* When the server is banned (in the [gfwlist](https://github.com/gfwlist/gfwlist)), this proxy will prefer to use the `socks proxy` to transfer data.
* When the server is located in internal network (`10.0.0.0/8`,`172.16.0.0/12`,`192.168.0.0/16`), no proxy.
* support multi-process `cluster` mode (and auto restart).
* support nodejs `worker thread` to determine ip location.
* `prometheus` metrics on endpoint `/http-socks/__/metric`

![](https://res.cloudinary.com/digf90pwi/image/upload/v1589102026/http-proxy-to-socks_1_ortiff.png)

## USAGE

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

## [LICENSE](./LICENSE.md)
