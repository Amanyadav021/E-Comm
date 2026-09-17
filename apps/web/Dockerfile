# ShopCraft storefront — build from the repository ROOT:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t shopcraft-web .
FROM node:22-alpine AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @shopcraft/shared && npm run build -w @shopcraft/web

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/web apps/web
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["npm", "run", "start"]
