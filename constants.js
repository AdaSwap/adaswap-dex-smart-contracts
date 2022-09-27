module.exports = {
    hardhat: {
        // for core
        ADMIN_ADDRESS: '0x6C12887a13A4f88D8da142f588C1285FfdABC7e5',
        FEE_ADDRESS: '0x15285DE40eA330eA141A73C99778598B4A5aD163',
        // for periphery
        FACTORY_ADDRESS: '0x75c02E2Bb0a17b6Ec9673941a1e58E2A2aC0c057',
        WETH_ADDRESS: '0x65a51E52eCD17B641f8F0D1d56a6c9738951FDC9',
        // for farms
        ASW_TOKEN_ADDRESS: '0xae83571000af4499798d1e3b0fa0070eb3a3e3f9',
        TREASURY_ADDRESS: '0xae83571000af4499798d1e3b0fa0070eb3a3e3f9',
    },
    milkomedaTestnet: {
        // for core
        ADMIN_ADDRESS: '0x6C12887a13A4f88D8da142f588C1285FfdABC7e5',
        FEE_ADDRESS: '0x15285DE40eA330eA141A73C99778598B4A5aD163',
        FACTORY_ADDRESS: '0xAa293D2262cFE5bBCE618f26E582e8E338237c8c',
        WETH_ADDRESS: '0x65a51E52eCD17B641f8F0D1d56a6c9738951FDC9',
        // for farms
        ASW_TOKEN_ADDRESS: '',
        TREASURY_ADDRESS: '',
    },
    milkomedaMainnet: {
        // for core
        ADMIN_ADDRESS: '',
        FEE_ADDRESS: '',
        // for periphery
        FACTORY_ADDRESS: '',
        WETH_ADDRESS: '',
        // for farms
        // Admin address is setted according to deployer address (Ownable)
        ASW_TOKEN_ADDRESS: '',
        TREASURY_ADDRESS: '',
    }
};