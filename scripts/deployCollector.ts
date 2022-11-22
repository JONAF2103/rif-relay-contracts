import * as fs from 'fs';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Collector } from 'typechain-types';

export const DEFAULT_CONFIG_FILE_NAME = 'deploy-collector.input.json';
export const DEFAULT_OUTPUT_FILE_NAME = 'revenue-sharing-addresses.json';

export interface Partner {
  beneficiary: string;
  share: number;
}

interface CollectorConfig {
  collectorOwner: string;
  partners: Partner[];
  tokenAddress: string;
  remainderAddress: string;
}

export type DeployCollectorArg = {
  collectorConfigFileName?: string;
  outputFileName?: string;
};

type ChainId = string;
type OutputCollectorConfig = CollectorConfig | { collectorContract: string };
export type OutputConfig = Record<ChainId, OutputCollectorConfig>;

export const deployCollector = async (
  taskArgs: DeployCollectorArg,
  hre: HardhatRuntimeEnvironment
) => {
  const { ethers, network } = hre;

  if (!network) {
    throw new Error('Unknown Network');
  }

  let collectorConfigFileName = taskArgs.collectorConfigFileName;

  if (!collectorConfigFileName) {
    console.warn(
      "Missing '--collectorConfig' parameter, 'deploy-collector.input.json' will be used"
    );
    collectorConfigFileName = DEFAULT_CONFIG_FILE_NAME;
  }

  if (!fs.existsSync(collectorConfigFileName)) {
    throw new Error('Could not find Collector configuration file');
  }

  const inputConfig = JSON.parse(
    fs.readFileSync(collectorConfigFileName, { encoding: 'utf-8' })
  ) as CollectorConfig;

  const { collectorOwner, partners, tokenAddress, remainderAddress } =
    inputConfig;

  const collectorFactory = await ethers.getContractFactory('Collector');
  const collector = await collectorFactory.deploy(
    collectorOwner,
    tokenAddress,
    partners,
    remainderAddress
  );

  await printReceipt(collector);

  console.log();

  console.log(
    '|=============================================|==================================================|'
  );
  console.log(
    '| Entity                                      | Address                                          |'
  );
  console.log(
    '|=============================================|==================================================|'
  );
  partners.forEach(function (partner, i) {
    console.log(
      `| Revenue Partner #${i + 1}, share` +
        ' '.repeat(20 - (i + 1).toString().length) +
        `| ${partner.beneficiary}, ${partner.share}%` +
        ' '.repeat(4 - partner.share.toString().length) +
        `|`
    );
  });
  console.log(
    `| Collector Contract                          | ${collector.address}       |`
  );
  console.log(
    `| Collector Owner                             | ${await collector.owner()}       |`
  );
  console.log(
    `| Collector Token                             | ${await collector.token()}       |`
  );
  console.log(
    `| Collector Remainder                         | ${remainderAddress}       |`
  );
  console.log(
    '|=============================================|==================================================|\n'
  );

  console.log('Generating json config file...');

  const outputFileName = taskArgs.outputFileName ?? DEFAULT_OUTPUT_FILE_NAME;

  let jsonConfig: OutputConfig;

  if (fs.existsSync(outputFileName)) {
    jsonConfig = JSON.parse(
      fs.readFileSync(outputFileName, { encoding: 'utf-8' })
    ) as OutputConfig;
  } else {
    jsonConfig = {};
  }

  const networkId = (await ethers.provider.getNetwork()).chainId;

  jsonConfig[networkId] = {
    collectorContract: collector.address,
    collectorOwner: await collector.owner(),
    tokenAddress: await collector.token(),
    remainderAddress: remainderAddress,
    partners,
  };

  fs.writeFileSync(outputFileName, JSON.stringify(jsonConfig));
};

async function printReceipt(collector: Collector) {
  const printLine = () => console.log('-'.repeat(98));

  console.log('Transaction Receipt');
  printLine();

  const txReceipt = await collector.deployTransaction.wait();

  const receiptToPrint = {
    hash: collector.deployTransaction.hash,
    from: txReceipt.from,
    blockNumber: txReceipt.blockNumber,
    gasUsed: txReceipt.gasUsed.toString(),
  };

  for (const [key, value] of Object.entries(receiptToPrint)) {
    console.log(
      `> ${key} ` +
        `${' '.repeat(20 - key.length)}` +
        `| ${value} ` +
        `${' '.repeat(70 - value.toString().length)} |`
    );
  }

  printLine();
  console.log();
}
