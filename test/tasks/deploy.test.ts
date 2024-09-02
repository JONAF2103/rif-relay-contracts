import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract, ContractFactory } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon from 'sinon';
import { deployContracts, updateConfig } from '../../tasks/deploy';
import { ContractAddresses } from '../../utils/scripts/types';

use(chaiAsPromised);

describe('Deploy Script', function () {
  describe('deployContracts', function () {
    const testAddress = '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7';

    beforeEach(function () {
      const contract = new Contract(testAddress, []);
      const contractFactoryStub = sinon.createStubInstance(ContractFactory);
      sinon.stub(ethers, 'getContractFactory').resolves(contractFactoryStub);
      contractFactoryStub.deploy.resolves(contract);
    });

    afterEach(function () {
      sinon.restore();
    });

    describe('if no flags are specified', function () {
      it('should deploy all contracts', async function () {
        const result = await deployContracts({}, ethers);
        expect(result).to.have.all.keys(
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
          'VersionRegistry',
          'BoltzDeployVerifier',
          'BoltzRelayVerifier',
          'BoltzSmartWallet',
          'BoltzSmartWalletFactory',
          'MinimalBoltzDeployVerifier',
          'MinimalBoltzRelayVerifier',
          'MinimalBoltzSmartWallet',
          'MinimalBoltzSmartWalletFactory'
        );
      });

      it('should deploy contracts with valid addresses', async function () {
        const result = await deployContracts({}, ethers);
        Object.values(result).forEach((value) => {
          expect(value, value).to.eq(testAddress);
        });
      });
    });

    describe('if flags are specified', function () {
      it('should deploy the relayHub', async function () {
        const result = await deployContracts({ relayHub: true }, ethers);
        const expectedKeys = ['Penalizer', 'RelayHub'];
        const unexpectedKeys = [
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the default smart wallet', async function () {
        const result = await deployContracts(
          { defaultSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
        ];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the custom smart wallet', async function () {
        const result = await deployContracts(
          { customSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
        ];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the native holder wallet', async function () {
        const result = await deployContracts(
          { nativeHolderSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
        ];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the util token', async function () {
        const result = await deployContracts({ utilToken: true }, ethers);
        const expectedKeys = ['UtilToken'];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the version registry', async function () {
        const result = await deployContracts({ versionRegistry: true }, ethers);
        const expectedKeys = ['VersionRegistry'];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the boltz wallet', async function () {
        const result = await deployContracts(
          { boltzSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'BoltzSmartWallet',
          'BoltzSmartWalletFactory',
          'BoltzRelayVerifier',
          'BoltzDeployVerifier',
        ];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the relay hub and the default smart wallet', async function () {
        const result = await deployContracts(
          { relayHub: true, defaultSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
        ];
        const unexpectedKeys = [
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
          'UtilToken',
          'VersionRegistry',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the custom smart wallet and the native holder smart wallet', async function () {
        const result = await deployContracts(
          { customSmartWallet: true, nativeHolderSmartWallet: true },
          ethers
        );
        const expectedKeys = [
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
        ];
        const unexpectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'UtilToken',
          'VersionRegistry',
        ];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });

      it('should deploy the relay hub, the default smart wallet, the custom smart wallet and the native holder smart wallet', async function () {
        const result = await deployContracts(
          {
            relayHub: true,
            defaultSmartWallet: true,
            customSmartWallet: true,
            nativeHolderSmartWallet: true,
          },
          ethers
        );
        const expectedKeys = [
          'Penalizer',
          'RelayHub',
          'SmartWallet',
          'SmartWalletFactory',
          'DeployVerifier',
          'RelayVerifier',
          'CustomSmartWallet',
          'CustomSmartWalletFactory',
          'CustomSmartWalletDeployVerifier',
          'CustomSmartWalletRelayVerifier',
          'NativeHolderSmartWallet',
          'NativeHolderSmartWalletFactory',
          'NativeHolderSmartWalletDeployVerifier',
          'NativeHolderSmartWalletRelayVerifier',
        ];
        const unexpectedKeys = ['UtilToken', 'VersionRegistry'];
        expect(result).to.have.all.keys(...expectedKeys);
        expect(result).not.to.have.any.keys(...unexpectedKeys);
      });
    });
  });

  describe('updateConfig', function () {
    const previouslyDeployedContracts: Partial<ContractAddresses> = {
      Penalizer: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayHub: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      SmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      DeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      RelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletDeployVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      CustomSmartWalletRelayVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletFactory:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletDeployVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      NativeHolderSmartWalletRelayVerifier:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzSmartWalletFactory: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzDeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      BoltzRelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzSmartWallet: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzSmartWalletFactory:
        '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzDeployVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      MinimalBoltzRelayVerifier: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      UtilToken: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
      VersionRegistry: '0x145845fd06c85B7EA1AA2d030E1a747B3d8d15D7',
    };

    const chainContractAddresses = {
      'regtest.33': previouslyDeployedContracts,
    };

    beforeEach(function () {
      hre.hardhatArguments.network = 'regtest';
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = 33;
      }
    });

    afterEach(function () {
      sinon.restore();
    });

    it('should update the contract addresses with only the deployed contracts', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      const deployedContracts = {
        Penalizer: '0x123abc',
        RelayHub: '0xabc123',
      };
      const config = await updateConfig(deployedContracts, hre);
      const expectedConfig = {
        'regtest.33': {
          ...previouslyDeployedContracts,
          ...deployedContracts,
        },
      };
      expect(config).to.be.deep.eq(expectedConfig);
    });

    it('should generate a new config when no previously deployed contracts are available', async function () {
      sinon.stub(fs, 'existsSync').returns(false);
      const config = await updateConfig(previouslyDeployedContracts, hre);
      const expectedConfig = {
        'regtest.33': {
          ...previouslyDeployedContracts,
        },
      };
      expect(config).to.be.deep.eq(expectedConfig);
    });

    it('should throw if network is undefined', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hre.hardhatArguments.network = undefined;
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = 33;
      }
      await expect(
        updateConfig(previouslyDeployedContracts, hre)
      ).to.be.rejectedWith('Unknown Network');
    });

    it('should throw if chainId is undefined', async function () {
      sinon.stub(fs, 'existsSync').returns(true);
      sinon
        .stub(fs, 'readFileSync')
        .returns(JSON.stringify(chainContractAddresses));
      hre.hardhatArguments.network = 'regtest';
      if (hre.config.networks['regtest']) {
        hre.config.networks['regtest'].chainId = undefined;
      }
      await expect(
        updateConfig(previouslyDeployedContracts, hre)
      ).to.to.be.rejectedWith('Unknown Chain Id');
    });
  });
});
