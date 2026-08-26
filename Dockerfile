FROM node:22-alpine

WORKDIR /usr/src/api

COPY package*.json .npmrc ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
