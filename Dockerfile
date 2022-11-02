FROM node:14.18.0-slim

RUN mkdir -p /code
WORKDIR /code

COPY . /code

# RUN yarn config set "strict-ssl" false
RUN yarn install --production 
RUN yarn cache clean
RUN yarn build

CMD ["yarn","start"]

EXPOSE 8080
