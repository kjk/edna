# build frontend (vite.config.js runs `git rev-parse`, so git and .git are needed)
FROM oven/bun:1-alpine AS frontend
RUN apk add --no-cache git
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# build Go server with the frontend embedded
FROM golang:1.26-alpine AS server
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /app/dist ./dist
RUN go build -buildvcs=false -o edna .

FROM alpine:3
WORKDIR /app
COPY --from=server /app/edna .
EXPOSE 9325
ENTRYPOINT ["./edna"]
