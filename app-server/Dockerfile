FROM node:22-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS go-builder

WORKDIR /src
COPY app-server/go.mod ./
COPY app-server/cmd ./cmd
COPY app-server/internal ./internal
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /app-server ./cmd/server

FROM alpine:3.21

WORKDIR /app
COPY --from=go-builder /app-server /app/app-server
COPY --from=frontend-builder /frontend/dist /app/public

EXPOSE 3000
CMD ["/app/app-server"]
