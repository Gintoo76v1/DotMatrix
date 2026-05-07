FROM node:20-alpine

WORKDIR /app

# Build deps für native module (argon2)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server/index.js"]
