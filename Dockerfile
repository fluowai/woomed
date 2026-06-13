FROM golang:1-alpine AS go-build
WORKDIR /src
COPY whatsmeow-bridge/ .
RUN go mod download
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/whatsmeow-bridge .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173

RUN apk add --no-cache ca-certificates tzdata

COPY --from=go-build /out/whatsmeow-bridge /app/whatsmeow-bridge/whatsmeow-bridge
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data /app/whatsmeow-bridge

EXPOSE 5173
VOLUME ["/app/data"]

CMD ["npm", "run", "start"]
