#!/usr/bin/env node
import 'source-map-support/register';

import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import { DockerImageLambdaFunctionProps, EnvAwareStackProps } from './interfaces';
import { DockerImageLambdaFunction } from './lambdaFunctionConstruct';
import { VersionedStack } from './versionedStack';

/**
 * Create a Lambda Function from a Docker image.
 */
export class DockerImageLambdaFunctionStack extends VersionedStack {
    public readonly function: DockerImageFunction;
    private readonly envProps: EnvAwareStackProps;

    constructor(scope: Construct, id: string, props: EnvAwareStackProps) {
        super(scope, id, props);

        this.envProps = props;

        const fn = new DockerImageLambdaFunction(this, id, props);
        this.function = fn.function;
    }

    public build(props: DockerImageLambdaFunctionProps) {
        const fn = new DockerImageLambdaFunction(this, this.stackName, this.envProps);
        fn.build(props);
    }
}
