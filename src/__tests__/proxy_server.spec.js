const mockAgent = {};

const mockOn = jest.fn();

jest.mock('http', () => ({
  request: jest.fn(() => ({
    on: mockOn,
  })),
  Server: jest.fn(function Server() {
    this.addListener = jest.fn();
  }),
}));

jest.mock('socks', () => ({
  createConnection: jest.fn(),
  Agent: jest.fn(() => mockAgent),
}));

function last(array) {
  return array[array.length - 1];
}

function getLastMockOn(event) {
  return last(mockOn.mock.calls.filter((args) => args[0] === event));
}

const http = require('http');
const Socks = require('socks');
const {
  createServer,
  getProxyObject,
  parseProxyLine,
  requestListener,
  connectListener,
} = require('../proxy_server');
const { random_int } = require('../util');
const { logger } = require("../logger");


describe('proxy_server', () => {
  const HTTP_PORT = random_int(40000, 50000);
  const SOCKS_PORT = random_int(30000, 39999);
  const requestURL = 'https://google.com';
  let getProxyInfo;
  let request;
  let socksRequest;
  let response;
  let socketRequest;
  let socket;

  beforeAll(() => {
    logger.transports[0].silent = true;
  });

  beforeEach(() => {
    getProxyInfo = jest.fn(() => ({
      ipaddress: '127.0.0.1',
      port: HTTP_PORT,
      type: 5,
      authentication: { username: '', password: '' },
    }));

    request = {
      on: jest.fn(),
      pipe: jest.fn(),
      url: requestURL,
    };

    socksRequest = {
      on: jest.fn(),
      pipe: jest.fn(),
      url: requestURL.slice('https://'.length),
    };

    response = {
      on: jest.fn(),
      writeHead: jest.fn(),
      end: jest.fn(),
    };

    socketRequest = {
      on: jest.fn(),
      write: jest.fn(),
      pipe: jest.fn(),
    };

    socket = {
      on: jest.fn(),
      pipe: jest.fn(),
      write: jest.fn(),
      resume: jest.fn(),
    };
  });

  describe('getProxyObject', () => {
    it('should return a object with "ipaddress", "port", "type", "authentication" properties', () => {
      const host = '127.0.0.1';
      const port = `${HTTP_PORT}`;
      const res = getProxyObject(host, port);

      expect(typeof res).toBe('object');
      expect(res.ipaddress).toBe(host);
      expect(res.port).toBe(parseInt(port, 10));
      expect(res.type).toBe(5);
      expect(typeof res.authentication).toBe('object');
      expect(Object.hasOwnProperty.apply(res.authentication, ['username'])).toBeTruthy();
      expect(Object.hasOwnProperty.apply(res.authentication, ['password'])).toBeTruthy();
    });
  });

  describe('parseProxyLine', () => {
    it('should return a object with "host" and "port" extracted from proxy string', () => {
      const proxyLine = `127.0.0.1:${SOCKS_PORT}`;
      const res = parseProxyLine(proxyLine);

      expect(typeof res).toBe('object');
      expect(res.ipaddress).toBe('127.0.0.1');
      expect(res.port).toBe(SOCKS_PORT);
    });

    it('should also contain "username" and "password" properties when it contains these info', () => {
      const proxyLine = `127.0.0.1:${SOCKS_PORT}:oyyd:password`;
      const res = parseProxyLine(proxyLine);

      expect(typeof res).toBe('object');
      expect(res.ipaddress).toBe('127.0.0.1');
      expect(res.port).toBe(SOCKS_PORT);
      expect(typeof res.authentication).toBe('object');
      expect(res.authentication.username).toBe('oyyd');
      expect(res.authentication.password).toBe('password');
    });

    it('should throw error when the proxy string seems not good', () => {
      let proxyLine = '127.0.0.1';
      let error = null;

      try {
        error = parseProxyLine(proxyLine);
      } catch (err) {
        error = err;
      }

      expect(error instanceof Error).toBeTruthy();

      proxyLine = `127.0.0.1:${HTTP_PORT}:oyyd`;
      error = null;

      try {
        error = parseProxyLine(proxyLine);
      } catch (err) {
        error = err;
      }

      expect(error instanceof Error).toBeTruthy();
    });
  });

  describe('requestListener', () => {
    it('should create an socks agent and take it as request agent', async () => {
      await requestListener(getProxyInfo, request, response);

      const lastCall = last(Socks.Agent.mock.calls);
      const httpLastCall = last(http.request.mock.calls);

      expect(requestURL.indexOf(lastCall[0].target.host) > -1).toBeTruthy();
      expect(httpLastCall[0].agent === mockAgent).toBeTruthy();
    });

    it('should return 500 when error thrown', async () => {
      await requestListener(getProxyInfo, request, response);

      const onErrorArgs = getLastMockOn('error');

      expect(onErrorArgs).toBeTruthy();

      const error = new Error('500');

      onErrorArgs[1](error);

      expect(response.writeHead.mock.calls[0][0]).toBe(500);
      expect(response.end.mock.calls[0][0].indexOf('error') > -1).toBeTruthy();
    });

    it('should pipe response when "response"', async () => {
      const proxyResponse = {
        statusCode: 200,
        headers: {},
        pipe: jest.fn(),
      };

      await requestListener(getProxyInfo, request, response);

      const onResponseArgs = getLastMockOn('response');

      expect(onResponseArgs).toBeTruthy();

      onResponseArgs[1](proxyResponse);

      expect(proxyResponse.pipe.mock.calls[0][0]).toBe(response);
    });
  });

  describe('connectListener', () => {
    it('should create socks connections', async () => {
      const head = '';
      await connectListener(getProxyInfo, socksRequest, socketRequest, head);

      const lastCreateConnectionCall = last(Socks.createConnection.mock.calls);

      expect(lastCreateConnectionCall[0].target.host).toBe('google.com');
    });

    it('should write 500 when error thrown', async () => {
      const head = '';
      await connectListener(getProxyInfo, socksRequest, socketRequest, head);

      const lastCreateConnectionCall = last(Socks.createConnection.mock.calls);

      const error = new Error('500');

      lastCreateConnectionCall[1](error, socket);

      expect(socketRequest.write.mock.calls[0][0].indexOf('500') > -1).toBeTruthy();
      expect(socket.pipe.mock.calls.length === 0).toBeTruthy();
    });

    it('should pipe sockets when socket connected', async () => {
      const head = '';

      await connectListener(getProxyInfo, socksRequest, socketRequest, head);

      const lastCreateConnectionCall = last(Socks.createConnection.mock.calls);

      lastCreateConnectionCall[1](null, socket);

      expect(socketRequest.pipe.mock.calls[0][0]).toBe(socket);
      expect(socket.pipe.mock.calls[0][0]).toBe(socketRequest);
      expect(socketRequest.write.mock.calls[0][0].indexOf('200') > -1).toBeTruthy();
      expect(socket.write.mock.calls[0][0]).toBe(head);
    });
  });

  describe('createServer', () => {
    it('should push this.proxyList', () => {
      const options = {
        socks: `127.0.0.1:${SOCKS_PORT}`,
      };

      createServer(options);

      const { proxyList } = http.Server.mock.instances[0];

      expect(proxyList[0].ipaddress).toBe('127.0.0.1');
      expect(proxyList[0].port).toBe(SOCKS_PORT);
    });

    it('should listen both "request" and "connect" events', () => {
      const options = {
        proxy: `127.0.0.1:${SOCKS_PORT}`,
      };

      createServer(options);

      const { addListener } = http.Server.mock.instances[0];

      const onRequestArgs = addListener.mock.calls.filter((args) => args[0] === 'request');
      const onConnectArgs = addListener.mock.calls.filter((args) => args[0] === 'connect');

      expect(onRequestArgs.length > 0).toBeTruthy();
      expect(onConnectArgs.length > 0).toBeTruthy();
    });
  });
});
