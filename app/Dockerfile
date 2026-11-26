FROM golang:1.25 AS build
WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.20
WORKDIR /app
COPY --from=build /src/server .
COPY static ./static
EXPOSE 8000
CMD ["./server"]