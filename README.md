# Adaswap DEX
## Project requirements

- Node v>=16

## First steps

1. Clone repository git clone `git@bitbucket.org:adaswap/adaswap-dex-smart-contracts.git`
2. Run `npm i` to install common environment package `dotenv`
3. Create a `.env` file, copy all fields from `.env.example` to created file and paste your private keys

---

## Core 

`cd core`

### Install dependencies

`npm i`

### Compile contracts

`npm run compile`

### Run tests 

`npm run test-headless`

### Deploy contracts

- First setup deployment parameters in `constants.js`

- `npm run deploy --network NETWORK_NAME`

---

## Periphery

`cd periphery`

### Install dependencies

`npm i`

### Compile contracts

`npm run compile`

### Run tests 

`npm run test-headless`

### Deploy contracts

- First setup deployment parameters in `constants.js`

- `npm run deploy --network NETWORK_NAME`


## Lib

`cd lib`

### Install dependencies

`npm i`

### Compile contracts

`npm run compile`


## Publishing NPM packages for each core/lib/periphery

- Rebuild Whole Contracts by run: `truffle compile`

- Update version of package in `package.json`

- Publish package: `npm publish --access public`