# ShopCraft admin — build from the repository ROOT:
#   docker build -f apps/admin/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t shopcraft-admin .
FROM node:22-alpine AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN npm install --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN npm run build -w @shopcraft/shared && npm run build -w @shopcraft/admin

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/admin apps/admin
WORKDIR /repo/apps/admin
EXPOSE 3100
CMD ["npm", "run", "start"]
