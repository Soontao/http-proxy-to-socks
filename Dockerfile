FROM node:14

WORKDIR /app

ADD package.json .
ADD package-lock.json .

RUN npm i

COPY . .

EXPOSE 18080

CMD ["sh", "node ./bin/hpts.js --host 0.0.0.0 --port 18080 --socks $SOCKS_SERVER"]
