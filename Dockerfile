FROM golang:1.26-alpine

RUN set -eux \
  & apk add \
  --no-cache \
  nodejs \
  npm \
  git


RUN mkdir /app
WORKDIR /app

COPY . /app
RUN go run . -build-frontend \
  && go build -o edna .

ENTRYPOINT ["./edna"]
