import { MockContract, smock } from '@defi-wonderland/smock';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Contract, ContractFactory } from 'ethers';
import fs from 'fs';
import * as hre from 'hardhat';
import { ethers } from 'hardhat';
import sinon, { SinonStub, SinonStubbedInstance } from 'sinon';
import { Collector, Collector__factory } from 'typechain-types';
import {
  CollectorConfig,
  DEFAULT_CONFIG_FILE_NAME,
  DEFAULT_OUTPUT_FILE_NAME,
  deployCollector,
  DeployCollectorArg,
  OutputConfig,
} from '../../../tasks/collector/deployCollector';

use(smock.matchers);
use(chaiAsPromised);

describe('Deploy Script', function () {
  const collectorConfiguration: CollectorConfig = {
    collectorOwner: '0x4E28f372BCe2d0Bf1B129b6A278F582558BF08a7',
    partners: [
      {
        beneficiary: '0x7986b3DF570230288501EEa3D890bd66948C9B79',
        share: 20,
      },
      {
        beneficiary: '0x0a3aA774752ec2042c46548456c094A76C7F3a79',
        share: 80,
      },
    ],
    tokenAddresses: ['0x726ECC75d5D51356AA4d0a5B648790cC345985ED'],
    remainderAddress: '0xc354D97642FAa06781b76Ffb6786f72cd7746C97',
  };
  let configurationFileContent: string;
  let collectorContractFactoryStub: SinonStubbedInstance<ContractFactory>;
  let collector: MockContract<Collector>;

  describe('deployContracts', function () {
    beforeEach(async function () {
      configurationFileContent = JSON.stringify(collectorConfiguration);

      const collectorFactoryMock = await smock.mock<Collector__factory>(
        'Collector'
      );
      collector = await collectorFactoryMock.deploy(
        collectorConfiguration.collectorOwner,
        collectorConfiguration.tokenAddresses,
        collectorConfiguration.partners,
        collectorConfiguration.remainderAddress
      );
      collectorContractFactoryStub = sinon.createStubInstance(ContractFactory);
      sinon
        .stub(ethers, 'getContractFactory')
        .resolves(collectorContractFactoryStub);
      collectorContractFactoryStub.deploy.resolves(
        collector as unknown as Contract
      );
    });

    afterEach(function () {
      sinon.restore();
    });

    it("should raise an error if the configuration file doesn't exist", async function () {
      sinon.stub(fs, 'existsSync').onFirstCall().returns(false);
      const taskArgs: DeployCollectorArg = {};
      await expect(deployCollector(taskArgs, hre)).to.be.rejectedWith(
        'Could not find Collector configuration file',
        "The deployCollector function doesn't raise an error if the file doesn't exist"
      );
    });

    describe('if the configuration file exists', function () {
      let readFileSyncStub: SinonStub;
      let fsExistsSyncStub: SinonStub;

      beforeEach(function () {
        fsExistsSyncStub = sinon.stub(fs, 'existsSync');
        fsExistsSyncStub.onFirstCall().returns(true);
        readFileSyncStub = sinon.stub(fs, 'readFileSync');
        readFileSyncStub.onFirstCall().returns(configurationFileContent);
      });

      afterEach(function () {
        sinon.restore();
      });

      it("should use the default configuration file if 'collectorConfig' isn't specified", async function () {
        const taskArgs: DeployCollectorArg = {};
        await expect(deployCollector(taskArgs, hre)).not.to.be.rejected;
        expect(
          readFileSyncStub.calledWithExactly(DEFAULT_CONFIG_FILE_NAME, {
            encoding: 'utf-8',
          })
        ).to.be.true;
      });

      it('should use the configuration file specified', async function () {
        const configFileName = 'inputFile.json';
        const taskArgs: DeployCollectorArg = {
          configFileName,
        };
        await expect(deployCollector(taskArgs, hre)).not.to.be.rejected;
        expect(
          readFileSyncStub.calledWithExactly(configFileName, {
            encoding: 'utf-8',
          })
        ).to.be.true;
      });

      it('deploy a collector', async function () {
        //FIXME: Mismatch of test case and test itself
        const configFileName = 'inputFile.json';
        const taskArgs: DeployCollectorArg = {
          configFileName,
        };
        await expect(deployCollector(taskArgs, hre)).not.to.be.rejected;

        expect(await collector.owner()).to.be.eq(
          collectorConfiguration.collectorOwner
        );
        expect(await collector.getTokens()).to.have.members(
          collectorConfiguration.tokenAddresses
        );
        const partners = await collector.getPartners();

        expect(partners).to.have.deep.members(
          collectorConfiguration.partners.map(({ beneficiary, share }) => [
            beneficiary,
            share,
          ])
        );
      });

      describe('', function () {
        let writeFileSyncStub: SinonStub;

        beforeEach(function () {
          fsExistsSyncStub.onSecondCall().returns(false);
          writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
        });

        async function expectOutputFilename(outputFileName: string) {
          const chainId = (await ethers.provider.getNetwork()).chainId;
          const expectedConfiguration: OutputConfig = {
            [chainId.toString()]: {
              collectorContract: collector.address,
              collectorOwner: await collector.owner(),
              tokenAddresses: await collector.getTokens(),
              remainderAddress: collectorConfiguration.remainderAddress,
              partners: collectorConfiguration.partners,
            },
          };
          expect(
            writeFileSyncStub.calledWith(
              outputFileName,
              JSON.stringify(expectedConfiguration)
            )
          ).to.be.true;
        }

        it("should use the default output file if no 'outputFileName' is specified", async function () {
          const configFileName = 'inputFile.json';
          const taskArgs: DeployCollectorArg = {
            configFileName,
          };
          await expect(deployCollector(taskArgs, hre)).not.to.be.rejected;

          await expectOutputFilename(DEFAULT_OUTPUT_FILE_NAME);
        });

        it("should use the output file specified by the 'outputFileName' argument", async function () {
          const configFileName = 'inputFile.json';
          const outputFileName = 'outputFile.json';
          const taskArgs: DeployCollectorArg = {
            configFileName,
            outputFileName,
          };
          await expect(deployCollector(taskArgs, hre)).not.to.be.rejected;

          await expectOutputFilename(outputFileName);
        });
      });
    });
  });
});
