# ShopCraft API — build from the repository ROOT:
#   docker build -f apps/api/Dockerfile -t shopcraft-api .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @shopcraft/shared \
 && cd apps/api && npx prisma generate && npx nest build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/
WORKDIR /repo/apps/api
EXPOSE 4000
# Apply pending migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
