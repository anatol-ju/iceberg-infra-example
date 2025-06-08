#!/usr/bin/env node

import { App } from 'aws-cdk-lib';
import { EnvAwareStackProps } from '../lib/interfaces';

export const app = new App();
export const envName = app.node.tryGetContext('env');
export const envConfig = app.node.tryGetContext('envs')[envName];

if (!envConfig) {
  throw new Error(`Missing context for env: ${envName}`);
}

export const stackProps: EnvAwareStackProps = {
  env: {
    account: envConfig.account,
    region: envConfig.region,
  },
  environment: envName,
};

// Export the stack
export * from '../bin/createIcebergTableAccess';
