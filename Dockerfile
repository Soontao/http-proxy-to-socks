FROM node:14

WORKDIR /app

COPY . .

RUN npm i

EXPOSE 18080

CMD ["node", "./bin/hpts.js", "--host 0.0.0.0", "--port 18080", "--socks $SOCKS_SERVER"]
