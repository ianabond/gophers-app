FROM golang:1.25-alpine AS builder

WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /auth-server ./cmd/server

FROM alpine:3.21

WORKDIR /app
COPY --from=builder /auth-server /app/auth-server

EXPOSE 3001
CMD ["/app/auth-server"]
