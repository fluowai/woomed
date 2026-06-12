FROM golang:1.23-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/whatsmeow-bridge .

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata wget
ENV PORT=8080
ENV WHATSMEOW_DATA_DIR=/app/data
COPY --from=build /out/whatsmeow-bridge /app/whatsmeow-bridge
EXPOSE 8080
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["/app/whatsmeow-bridge"]
