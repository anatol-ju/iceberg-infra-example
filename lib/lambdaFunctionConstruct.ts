#!/usr/bin/env node
import 'source-map-support/register';

import { Repository } from 'aws-cdk-lib/aws-ecr';
import {
    Architecture, DockerImageCode, DockerImageFunction, Function
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import { DockerImageLambdaFunctionProps, EnvAwareStackProps } from './interfaces';

/**
 * Create a Lambda Function using a Docker image.
 */
export class DockerImageLambdaFunction extends Construct {
    public function: Function;

    constructor(scope: Construct, id: string, props: EnvAwareStackProps) {
        super(scope, id);

        const { account, region } = props.env || {};
        if (!(account && region)) {
            throw Error("Account and/or region not set - these need to be set to build stack.")
        }
    }

    public build(props: DockerImageLambdaFunctionProps) {
        const repo = Repository.fromRepositoryName(this, `${this.node.id}-Repository`, props.repositoryName);

        // The PYTHONPATH is required to find the dependencies in the Docker image
        const pythonPath = [
            `/var/task/python`,
            `/var/task/python/lib/python${props.pythonVersion}/site-packages`,
            `/var/task/python/lib64/python${props.pythonVersion}/site-packages`
        ].join(":");

        // Add any additional paths to the PYTHONPATH
        if (props.pythonPath) {
            pythonPath.concat(props.pythonPath.join(":"));
        }

        const environmentVariables = {
            ...props.environmentVariables,
            PYTHONPATH: pythonPath
        };

        // If set, force function deployment by providing a date as the version
        if (props.setVersion) {
            environmentVariables.VERSION = new Date().toISOString();
        }

        const fn = new DockerImageFunction(this, this.node.id, {
            functionName: props.functionName,
            code: DockerImageCode.fromEcr(repo, {
                tagOrDigest: props.tagOrDigest
            }),
            memorySize: props.memorySize,
            logRetention: props.logRetention,
            timeout: props.timeout,
            architecture: Architecture.X86_64,
            environment: environmentVariables,
            reservedConcurrentExecutions: props.reservedConcurrentExecutions,
            role: props.role,
            events: props.eventSources,
            deadLetterQueueEnabled: !!props.dlq,    // Enable DLQ if it exists
            deadLetterQueue: props.dlq,             // Attach the DLQ (SQS queue)
        });

        this.function = fn;
    }
}
