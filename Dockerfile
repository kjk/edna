FROM golang:1.24-alpine3.21

RUN set -eux \
    & apk add \
        --no-cache \
        nodejs \
        yarn \
        npm \
        git


RUN mkdir /app
WORKDIR /app

COPY . /app
RUN go run . -build-frontend \
  && go build -o edna .

ENTRYPOINT ["./edna"]
