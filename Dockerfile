FROM node:12.9.1-alpine

# Create app directory
WORKDIR /usr/ScienceDbStarterPack/graphiql-auth

# Copy source code
COPY . .

# Install dependencies
RUN apk update && \
 apk add git && apk add bash && \
 rm .git* && \
 npm install

EXPOSE 7000
