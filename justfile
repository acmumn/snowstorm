create-database:
    sqlite3 snowstorm.db < schema.sql

wipe-state:
    rm snowstorm.db
    rm -rf uploads

install:
    npm install

build: install
    npm run build

start: build
    npm run start

dev: install
    npm run dev