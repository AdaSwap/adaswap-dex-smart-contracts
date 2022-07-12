# Adaswap DEX
## Project requirements

- Node v>=16

- Yarn

## First steps

1. Clone repository git clone `git@bitbucket.org:adaswap/adaswap-dex-smart-contracts.git`
2. Run `npm i` to install common environment package `dotenv`
3. Create a `.env` file, copy all fields from `.env.example` to created file and paste your private keys

### Before any contract deployment please configure `constants.js`

---

## Core 

`cd core`

### Install dependencies

`yarn`

### Compile contracts

`yarn compile`

### Run tests 

`yarn test`

### Run your local blockchain 

`yarn chain`

### Deploy contracts

- Milkomeda Testnet deployment: `yarn deploy-testnet`

- Milkomeda Mainnet deployment: `yarn deploy-mainnet`

- Local blockchain deployment: `yarn deploy-dev`

---

## Periphery

`cd periphery`

### Install dependencies

`yarn`

### Compile contracts

`yarn compile`

### Run tests 

`yarn test`

### Run your local blockchain 

`yarn chain`

### Deploy contracts

- Milkomeda Testnet deployment: `yarn deploy-testnet`

- Milkomeda Mainnet deployment: `yarn deploy-mainnet`

- Local blockchain deployment: `yarn deploy-dev`

---

## Lib

`cd lib`

### Install dependencies

`yarn`

### Compile contracts

`yarn compile`


## Publishing NPM packages for each core/lib/periphery

- Rebuild Whole Contracts by run: `yarn compile`

- Npm account login: `yarn login`

- Publish package: `yarn publish --access restricted`