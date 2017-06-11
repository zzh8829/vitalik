FROM node:boron

RUN mkdir -p /app
WORKDIR /app

COPY package.json .
RUN yarn install

COPY . .
