#!/usr/bin/env node
import 'source-map-support/register';

import { Stack } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

import { EnvAwareStackProps, SqsQueueProps } from './interfaces';
import { SqsQueue } from './sqsConstruct';

export class SqsStack extends Stack {
    private _queue: Queue;
    private _dlq: Queue;
    private _kmsKey: Key;
    private stackPrefix: string;
    private props: EnvAwareStackProps;

    constructor(scope: Construct, id: string, props: EnvAwareStackProps) {
        super(scope, id, props);

        const { env, environment } = props;
        const { account, region } = env || {};

        if (!(account && region)) {
            throw Error('Account and/or region not set - these need to be set to build stack.')
        }

        this.stackPrefix = id;
        this.props = props;
    }

    public get queue() {
        return this._queue
    }

    public get dlq() {
        return this._dlq
    }

    public get kmsKey() {
        return this._kmsKey
    }

    public build(props: SqsQueueProps) {
        const sqsQueue = new SqsQueue(this, this.stackPrefix, this.props);
        sqsQueue.build(props);
        this._queue = sqsQueue.queue;
        this._dlq = sqsQueue.dlq;
        this._kmsKey = sqsQueue.kmsKey;
    }
}
