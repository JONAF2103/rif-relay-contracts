import { ethers, hardhatArguments, config } from 'hardhat';
import fs from 'fs';
import {
  IChainContractAddresses,
  IContractAddresses,
} from '../interfaces/contracts';

export const generateJsonConfig = (contractAddresses: IContractAddresses) => {
  console.log('Generating json config file...');

  const configFileName = 'contract-addresses.json';
  let jsonConfig: Partial<IChainContractAddresses>;

  if (fs.existsSync(configFileName)) {
    jsonConfig = JSON.parse(
      fs.readFileSync(configFileName, { encoding: 'utf-8' })
    ) as IChainContractAddresses;
  } else {
    jsonConfig = {};
  }

  const { network } = hardhatArguments;
  if (!network) {
    throw new Error('Unknown Network');
  }
  const { chainId } = config.networks[network];

  if (!chainId) {
    throw new Error('Unknown Chain Id');
  }

  jsonConfig[chainId] = contractAddresses;

  fs.writeFileSync('contract-addresses.json', JSON.stringify(jsonConfig));
};

export const deployContracts = async () => {
  const relayHubF = await ethers.getContractFactory('RelayHub');
  const penalizerF = await ethers.getContractFactory('Penalizer');
  const smartWalletF = await ethers.getContractFactory('SmartWallet');
  const smartWalletFactoryF = await ethers.getContractFactory(
    'SmartWalletFactory'
  );
  const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const utilTokenF = await ethers.getContractFactory('UtilToken');

  const customSmartWalletF = await ethers.getContractFactory(
    'CustomSmartWallet'
  );
  const customSmartWalletFactoryF = await ethers.getContractFactory(
    'CustomSmartWalletFactory'
  );
  const customSmartWalletDeployVerifierF = await ethers.getContractFactory(
    'CustomSmartWalletDeployVerifier'
  );

  const { address: penalizerAddress } = await penalizerF.deploy();
  const { address: relayHubAddress } = await relayHubF.deploy(
    penalizerAddress,
    1,
    1,
    1,
    1
  );
  const { address: smartWalletAddress } = await smartWalletF.deploy();
  const { address: smartWalletFactoryAddress } =
    await smartWalletFactoryF.deploy(smartWalletAddress);
  const { address: deployVerifierAddress } = await deployVerifierF.deploy(
    smartWalletFactoryAddress
  );
  const { address: relayVerifierAddress } = await relayVerifierF.deploy(
    smartWalletFactoryAddress
  );

  const { address: customSmartWalletAddress } =
    await customSmartWalletF.deploy();
  const { address: customSmartWalletFactoryAddress } =
    await customSmartWalletFactoryF.deploy(customSmartWalletAddress);
  const { address: customDeployVerifierAddress } =
    await customSmartWalletDeployVerifierF.deploy(
      customSmartWalletFactoryAddress
    );

  const { address: customRelayVerifierAddress } = await relayVerifierF.deploy(
    customSmartWalletFactoryAddress
  );

  let utilTokenAddress;
  if(hardhatArguments.network != 'mainnet'){
    const { address } = await utilTokenF.deploy();
    utilTokenAddress = address
  }

  return {
    Penalizer: penalizerAddress,
    RelayHub: relayHubAddress,
    SmartWallet: smartWalletAddress,
    SmartWalletFactory: smartWalletFactoryAddress,
    SmartWalletDeployVerifier: deployVerifierAddress,
    SmartWalletRelayVerifier: relayVerifierAddress,
    CustomSmartWallet: customSmartWalletAddress,
    CustomSmartWalletFactory: customSmartWalletFactoryAddress,
    CustomSmartWalletDeployVerifier: customDeployVerifierAddress,
    CustomSmartWalletRelayVerifier: customRelayVerifierAddress,
    UtilToken: utilTokenAddress,
  };
};
