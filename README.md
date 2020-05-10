# fork project for http-proxy-to-socks

This is a for project for `http-proxy-to-socks`.

It will use as direct http proxy when the `http request targeted server ip` is in china mainland.

## Setup

```
npm install -g http-proxy-to-socks
```

Make sure your nodejs version is greater than `10.6`.

## Usage

```
hpts -s 127.0.0.1:1080 -p 8080
```

This will start a process listening on `8080` as a http proxy. It will convert http requests into socks requests and send them to port `1080`. Please make sure your socks service is available at the corresponding port.

Other options:

```
Usage: hpts [options]

Options:

  -V, --version          output the version number
  -s, --socks [socks]    specify your socks proxy host, default: 127.0.0.1:1080
  -p, --port [port]      specify the listening port of http proxy server, default: 8080
  -l, --host [host]      specify the listening host of http proxy server, default: 127.0.0.1
  -c, --config [config]  read configs from file in json format
  --level [level]        log level, vals: info, error
  -h, --help             output usage information
```

You can specify a `json` config file with `-c`:

```json
{
  "socks": "127.0.0.1:1080",
  "port": 8080
}
```

## CONTRIBUTE

Please add more tests for corresponding features when you send a PR:

```
npm run test
```

## [License](./LICENSE.md)
